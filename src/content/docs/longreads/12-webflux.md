---
title: "Лонгрид 12. Реактивный Spring. WebFlux"
description: "Project Reactor, Netty, EventLoop"
---

## 1. Введение: эволюция моделей обработки HTTP-запросов

Исторически веб-приложения эволюционировали от простой синхронной модели к сложным асинхронным и реактивным архитектурам. Каждый шаг был продиктован ростом требований к пропускной способности (throughput), задержкам (latency) и устойчивости к пиковым нагрузкам.

1. **Thread-per-Request (синхронная модель)**: один поток ОС обрабатывает весь жизненный цикл запроса. Просто в реализации, но плохо масштабируется при высоком количестве I/O-операций.
2. **Callback/Async (классическая асинхронность)**: использование `Future`, колбэков и пулов потоков. Позволяет не блокировать основной поток, но усложняет читаемость кода (`callback hell`) и не решает проблему управления скоростью потребления данных.
3. **Reactive Streams (реактивная модель)**: стандартизированный подход, объединяющий неблокирующее выполнение, асинхронную передачу сигналов и **обратное давление (backpressure)**. Позволяет обрабатывать десятки тысяч соединений на фиксированном малом пуле потоков.

Реактивное программирование – это не просто замена библиотеки, а смена парадигмы: от императивного «делай это, затем то» к декларативному «опиши, как данные должны преобразовываться при появлении».

---

## 2. Проблемы традиционных (синхронных и классических асинхронных) систем

### 2.1. Механизм работы Thread-per-Request
В классическом Servlet-контейнере (Tomcat, Jetty) каждый входящий HTTP-запрос делегируется отдельному потоку из пула. Поток выполняет:
- чтение заголовков и тела запроса;
- десериализацию JSON/XML;
- выполнение бизнес-логики;
- синхронные вызовы к БД, внешним API, файловой системе;
- сериализацию ответа и запись в сокет.

Пока поток ожидает ответа от внешнего ресурса, он переходит в состояние `WAITING`/`TIMED_WAITING`. В этом состоянии он не выполняет полезную работу, но занимает:
- **структуры ядра ОС**: `task_struct`, дескрипторы;
- **память JVM**: стек потока (по умолчанию 1 МБ на поток, настраивается через `-Xss`);
- **пул контейнера**: один слот из `maxThreads`.

### 2.2. Критические ограничения синхронной модели
| Проблема | Механизм возникновения | Технические последствия |
|----------|------------------------|-------------------------|
| **Истощение пула потоков** | Каждый I/O-вызов блокирует поток. При 200 потоках и задержке внешнего API 2 сек. сервер обрабатывает максимум 100 RPS. Новые запросы попадают в очередь ОС или получают HTTP 503 | Полная недоступность сервиса при пиковой нагрузке, каскадные отказы |
| **Накладные расходы на переключение контекста** | ОС приостанавливает поток, сохраняет регистры CPU, обновляет таблицы страниц памяти, кеш-линии L1/L2 становятся невалидными. При >1000 активных потоков CPU тратит >30% времени на переключение, а не на полезную работу | Рост latency, деградация throughput, нелинейное масштабирование |
| **Потребление памяти** | 10 000 соединений × 1 МБ стек = ~10 ГБ RAM только под стеки Плюс куча для объектов запроса/ответа | `OutOfMemoryError: unable to create native thread`, падение JVM |
| **Отсутствие контроля потока данных** | Если продюсер (БД, внешний API) генерирует данные быстрее, чем консьюмер обрабатывает, данные буферизируются в RAM до исчерпания памяти | Memory leaks, OOM, нестабильность сервиса |

### 2.3. Почему классический `CompletableFuture` не решает проблему
`CompletableFuture` позволяет выполнять задачи асинхронно, но он:
- не имеет встроенного механизма backpressure: `thenApply` не знает, готов ли потребитель принимать результат;
- ошибки обрабатываются фрагментарно (`exceptionally`, `handle`), нет гарантированной терминальности потока;
- комбинирование (`allOf`, `anyOf`) усложняется при вложенности;
- нет стандартизированного контракта: каждая библиотека реализует свою асинхронность.

---

## 3. Спецификация Reactive Streams: контракт и гарантии

**Reactive Streams** (инициатива 2013 года, стандартизирована в JDK 9 как `java.util.concurrent.Flow`) — это минимальный набор интерфейсов для асинхронной потоковой обработки с **неблокирующим обратным давлением**.

### 3.1. Формальный контракт
Спецификация определяет 4 интерфейса:

```java
// Источник данных
public interface Publisher<T> {
    void subscribe(Subscriber<? super T> s);
}

// Потребитель данных
public interface Subscriber<T> {
    void onSubscribe(Subscription s);
    void onNext(T t);
    void onError(Throwable t);
    void onComplete();
}

// Контроль потока и отмена подписки
public interface Subscription {
    void request(long n);
    void cancel();
}

// Трансформатор (и Subscriber<T>, и Publisher<R>)
public interface Processor<T, R> extends Subscriber<T>, Publisher<R> {}
```

### 3.2. Глубинные принципы работы
1. **Ленивость (Lazy Execution)**: `Publisher` не начинает эмиссию данных до вызова `subscribe()`. Это позволяет компоновать цепочки, оптимизировать их и передавать как объекты первого класса.
2. **Pull-Push-гибрид**:
    - `onNext` — это **push** (издатель толкает данные);
    - `request(n)` — это **pull** (подписчик явно запрашивает `n` элементов);
    - без `request(n)` издатель **не имеет права** вызывать `onNext`. Это и есть backpressure.
3. **Терминальность**: после `onError` или `onComplete` дальнейшие вызовы `onNext`/`onError`/`onComplete` запрещены. Подписчик обязан игнорировать их.
4. **Асинхронность сигналов**: все методы могут вызываться из любых потоков. Ни один метод не должен блокировать вызывающий поток (non-blocking guarantee).

### 3.3. Зачем нужен backpressure?
Представь видеостриминг: сервер отдаёт 4K-видео со скоростью 50 МБ/с, а клиент имеет слабый интернет и может обрабатывать 5 МБ/с. Без backpressure клиент будет буферизировать данные в RAM, пока не упадёт с OOM. С backpressure клиент явно сообщает: `request(10)`, получает 10 чанков, обрабатывает их, затем запрашивает ещё. Скорость определяется **слабым звеном**.

---

## 4. Project Reactor: философия, архитектура и примитивы

**Project Reactor** – эталонная реализация Reactive Streams для JVM, ядро реактивного стека Spring. Предоставляет богатый набор операторов, оптимизаций и инструментов отладки.

### 4.1. `Mono<T>` и `Flux<T>`
Оба реализуют `Publisher<T>`, но несут разную семантику.
- **`Mono<T>`**: 0 или 1 элемент. Используется для операций, возвращающих единственный результат (поиск по ID, сохранение, HTTP-запрос, проверка авторизации).
- **`Flux<T>`**: 0..N элементов. Используется для потоков, коллекций, событий, SSE, WebSocket-сообщений.
- **`Mono<Void>`**: специальный тип, не несущий данных. Сигнализирует только о завершении операции (например, `DELETE`, отправка уведомления).

### 4.2. Создание источников
```java
// Моментальная эмиссия
Mono<String> just = Mono.just("data");
Flux<Integer> range = Flux.range(1, 100);

// Отложенное выполнение (ленивое)
Mono<User> deferred = Mono.fromCallable(() -> userRepository.findByIdSync(1L));

// Пустой поток / Ошибка
Mono<Void> empty = Mono.empty();
Mono<Object> error = Mono.error(new RuntimeException("fail"));

// Периодическая эмиссия (бесконечный Flux)
Flux<Long> interval = Flux.interval(Duration.ofSeconds(1));
```
**Важно**: `fromCallable` оборачивает блокирующий код, но **не выполняет его** до подписки. Это фундаментальное отличие от `Mono.just()`, который вычисляет значение немедленно при создании.

### 4.3. Cold vs Hot Publishers
- **Cold**: данные генерируются заново для каждого подписчика. Реактор по умолчанию создаёт холодные потоки. Пример: `Mono.fromCallable(...)`, `Flux.just(...)`.
- **Hot**: данные эмиссируются независимо от подписчиков. Новые подписчики получают данные с момента подписки. Пример: `Flux.interval(...)`, `Sinks.Many`, сообщения из Kafka.

---

## 5. Операторы, ленивость и оптимизация (Fusion)

### 5.1. Пример цепочки с подробным разбором
```java
Flux.just("str_1", "str_2")
    .doOnSubscribe(s -> System.out.println("Subscribed"))
    .log()
    .map(str -> {
        System.out.println("Map: " + str);
        return str + str;
    })
    .filter(str -> {
        System.out.println("Filter: " + str);
        return !str.equals("str_1str_1");
    })
    .doOnNext(i -> System.out.println("onNext: " + i))
    .doOnComplete(() -> System.out.println("Complete"))
    .doOnError(e -> System.err.println("Error: " + e.getMessage()))
    .subscribe(str -> System.out.println("Received: " + str));
```
**Пошаговое выполнение**
1. Цепочка создаётся, но **ничего не происходит**.
2. Вызов `.subscribe()` инициализирует подписку снизу вверх.
3. `doOnSubscribe` фиксирует регистрацию.
4. `.log()` выводит внутренние события: `onSubscribe`, `request(unbounded)`, `onNext`, `onComplete`.
5. Reactor автоматически применяет **Fusion** (оптимизацию): если цепочка синхронна и не требует асинхронных границ, операторы объединяются в единый шаг, избегая создания промежуточных очередей и переключений потоков.
6. `.map` и `.filter` выполняются синхронно в том же потоке, что и подписка.
7. `.subscribe` – точка входа. Без неё код мёртв.

### 5.2. Классификация операторов
| Тип | Операторы | Назначение | Блокировка потока? |
|-----|-----------|------------|-------------------|
| **Трансформация** | `map`, `filter`, `peek` | Синхронное преобразование 1 : 1 или фильтрация | Нет (выполняется в текущем потоке) |
| **Асинхронная трансформация** | `flatMap`, `concatMap`, `switchMap` | Разворачивание `Publisher<Publisher<T>>` в `Publisher<T>` | Нет, но внутренняя подписка может быть асинхронной |
| **Объединение** | `merge`, `concat`, `zip` | Слияние нескольких потоков | Зависит от стратегии |
| **Сайд-эффекты** | `doOnNext`, `doOnError`, `doFinally` | Логирование, метрики, очистка | Нет |

**Различия `flatMap`/`concatMap`/`switchMap`**
- `flatMap`: запускает внутренние потоки параллельно (по умолчанию concurrency=256). Порядок результатов **не гарантируется**. Идеален для независимых I/O.
- `concatMap`: запускает строго последовательно. Сохраняет порядок. Подходит, когда важен порядок или нужно избегать параллельных запросов к ограниченным ресурсам.
- `switchMap`: при появлении нового элемента отменяет предыдущий внутренний поток и подписывается на новый. Идеален для автодополнения поиска (debounce + switch).

---

## 6. Управление потоками: Schedulers и Thread Context

Реактор отделён от ОС-потоков абстракцией `Scheduler`. Это пул потоков с заданной политикой выполнения.

### 6.1. Типы планировщиков
| Scheduler | Поведение | Когда использовать |
|-----------|-----------|-------------------|
| `immediate()` | Выполняет в текущем потоке немедленно | Тесты, синхронные сценарии, заглушки |
| `single()` | Один выделенный поток | Работа с не-thread-safe состоянием, последовательные задачи |
| `parallel()` | Пул фиксированного размера (`Runtime.getRuntime().availableProcessors()`) | **Только CPU-bound**: вычисления, парсинг, валидация |
| `boundedElastic()` | Динамический пул (до `10 × CPU`), потоки удаляются через 60 с простоя | **I/O-bound**: БД, файлы, HTTP, legacy sync. С Java 21+ использует Virtual Threads |
| `fromExecutor()` | Обёртка над кастомным `ExecutorService` | Интеграция с существующими пулами (например, Hikari, кастомные пулы) |

### 6.2. `subscribeOn` vs `publishOn`: глубинное различие
```java
Flux.range(1, 3)
    .log("Before")                      // Выполняется в параллельном пуле
    .subscribeOn(Schedulers.parallel()) // Определяет поток ИСТОЧНИКА
    .map(i -> i * 2)                    // parallel
    .publishOn(Schedulers.boundedElastic()) // Граница переключения
    .map(i -> i + 10)                   // boundedElastic
    .publishOn(Schedulers.parallel())   // Снова переключение
    .map(i -> i * 2)                    // parallel
    .subscribe(System.out::println);
```
- **`subscribeOn`**: влияет на фазу подписки. Определяет, в каком потоке будет создан источник данных и выполнены все операторы **до первого `publishOn`**. Позиция в цепочке не важна: Reactor поднимает его к корню.
- **`publishOn`**: вставляет оператор-границу, который переключает контекст для всех **нижележащих** операторов. Можно использовать многократно для сегментации пайплайна.

**Правило безопасности**: потоки Event Loop (Netty) должны заниматься только маршрутизацией событий. Любая операция >2 мс должна быть явно вынесена через `subscribeOn`/`publishOn` или использовать неблокирующий драйвер.

---

## 7. Обработка ошибок, Retry и Resilience

В Reactive Streams ошибка — терминальное событие. Поток завершается, downstream не получает данные. Для восстановления используются операторы перехвата.

### 7.1. Стратегии обработки ошибок
```java
// 1. Fallback на альтернативный Publisher
Mono<User> resilient = userRepository.findById(id)
    .onErrorResume(UserNotFoundException.class, e -> 
        Mono.just(User.defaultUser())
    );

// 2. Преобразование ошибки
Mono<User> mappedError = userRepository.findById(id)
    .onErrorMap(e -> new BusinessException("DB unavailable", e));

// 3. Повторные попытки (Retry)
Mono<?> withRetry = externalApi.call()
    .retryWhen(Retry.backoff(3, Duration.ofMillis(500))
        .maxBackoff(Duration.ofSeconds(5))
        .jitter(0.5) // Добавляем случайность, предотвращаем "thundering herd"
        .filter(e -> e instanceof TimeoutException)
        .onRetryExhaustedThrow((spec, signal) -> 
            new CircuitOpenException("Max retries reached", signal.failure())
        )
    );
```
**Теория**: простой `.retry(3)` опасен при системных сбоях (мгновенные повторы перегружают сервис). `Retry.backoff` с `jitter` – production-стандарт. В реальных системах интегрируется с Circuit Breaker (Resilience4j) для автоматического отключения недоступных эндпоинтов.

---

## 8. Spring WebFlux: архитектура, стек и выбор

### 8.1. WebFlux vs Web MVC
| Аспект | Spring Web MVC (Servlet Stack) | Spring WebFlux (Reactive Stack) |
|--------|--------------------------------|---------------------------------|
| Основа | Servlet API 3.1+ | Reactive Streams + Reactor |
| Контейнер | Tomcat, Jetty, Undertow (блокирующий) | Netty (по умолчанию), Undertow, Tomcat (async режим) |
| Модель потоков | Thread-per-Request | Event Loop + Worker Pools |
| Идеальный сценарий | CPU-bound, legacy JDBC, простой CRUD | I/O-bound, API-шлюзы, чаты, стриминг, высокая concurrency |
| Отладка | Прямые стек-трейсы, `Thread.dump()` | Асинхронные цепочки, требуют `Hooks.onOperatorDebug()` |

**Когда НЕ использовать WebFlux:**
- приложение выполняет тяжелые вычисления (ML, криптография, отчёты);
- зависит от blocking-only-библиотек (старые JDBC-драйверы, `RestTemplate`, `java.io`);
- команда не имеет опыта реактивного программирования (риск скрытых блокировок).

### 8.2. Аннотационный стиль vs функциональный стиль
```java
// Аннотационный (привычный, декларативный)
@RestController
@RequiredArgsConstructor
public class UserController {
    private final ReactiveUserService service;
    
    @GetMapping("/{id}")
    public Mono<ResponseEntity<UserDTO>> get(@PathVariable Long id) {
        return service.findById(id)
            .map(UserMapper::toDTO)
            .map(ResponseEntity::ok)
            .defaultIfEmpty(ResponseEntity.notFound().build());
    }
}
```
```java
// Функциональный (Router Functions, явное управление запросом)
@Configuration
public class UserRouter {
    @Bean
    public RouterFunction<ServerResponse> routes(UserHandler handler) {
        return RouterFunctions.route()
            .GET("/api/users/{id}", req -> 
                req.pathVariable("id").map(Long::parseLong)
                   .map(handler::getUser)
                   .orElse(Mono.error(() -> new BadRequestException())))
            .POST("/api/users", req -> 
                req.bodyToMono(CreateUserReq.class).flatMap(handler::create))
            .build();
    }
}
```
**Различия**
- Аннотации проще для миграции с MVC, поддерживают Swagger/OpenAPI из коробки.
- Функциональный стиль даёт полный контроль над `ServerRequest`/`ServerResponse`, легче тестируется изолированно, позволяет динамически регистрировать маршруты.

---

## 9. Netty, Event Loop и жизненный цикл запроса

### 9.1. Event Loop Pattern
Архитектурный паттерн, где один поток непрерывно выполняет цикл:
1. **Wait**: блокировка на `epoll` (Linux), `kqueue` (macOS), `IOCP` (Windows). Поток спит, пока ОС не сообщит о готовности сокета.
2. **Dispatch**: извлечение готовых событий (read, write, connect, timer).
3. **Execute**: выполнение обработчиков в пользовательском пространстве.

Преимущество: O(1) сложность обработки N соединений. 1 поток может обслуживать 10k+ соединений.

### 9.2. Netty: архитектура и оптимизации
Netty — фреймворк, инкапсулирующий Java NIO. Ключевые компоненты:
- `EventLoopGroup` — пул потоков Event Loop (обычно Boss group для accept, Worker group для I/O);
- `Channel` — абстракция сетевого соединения;
- `ChannelPipeline` — цепочка `ChannelHandler` (Inbound для чтения, Outbound для записи);
- `ByteBuf` — управляемый буфер с reference counting. Поддерживает heap/direct memory, zero-copy (`FileRegion`, `CompositeByteBuf`), детекцию утечек (`ResourceLeakDetector`).

**Управление памятью**: в отличие от `java.nio.ByteBuffer`, `ByteBuf` использует пулы (Arena), минимизирует GC-паузы и позволяет явно контролировать жизненный цикл через `retain()`/`release()`.

### 9.3. Жизненный цикл запроса в WebFlux + Netty
1. **Приём соединения.** Netty Boss thread принимает TCP handshake, регистрирует канал в Worker EventLoop.
2. **Чтение HTTP.** Worker thread читает байты через `epoll`, декодирует в `HttpRequest`. Тело читается лениво (chunked/streaming).
3. **Вход в Spring.** `ReactorHttpHandlerAdapter` передаёт запрос в `DispatcherHandler`. Вызывается `@RestController`/`HandlerFunction`.
4. **Выполнение логики.**
    - Если используется `WebClient`/`R2DBC` → регистрация колбэка, поток освобождается.
    - Если legacy JDBC → `.subscribeOn(boundedElastic())` передаёт задачу в worker-пул. EL не блокируется.
5. **Ответ.** Результат сериализуется (Jackson), передаётся в Netty `ChannelOutboundHandler`. Netty ставит байты в очередь записи, ОС асинхронно отправляет пакеты. Соединение остаётся открытым (HTTP Keep-Alive).

**Критическое правило**: Event Loop – это эстафетная палочка. Держи её минимальное время. Блокировка EL на 100 мс при 1000 соединений = 100 сек. суммарной задержки.

---

## 10. Тестирование и отладка реактивных приложений

### 10.1. `StepVerifier`: детерминированное тестирование
```java
@Test
void shouldEmitThreeItemsAndComplete() {
    Flux<String> flux = Flux.just("A", "B", "C");
    StepVerifier.create(flux)
        .expectNext("A")
        .expectNext("B")
        .expectNext("C")
        .verifyComplete(); // Блокирует тест до завершения, валидирует сигналы
}

@Test
void shouldHandleBackpressure() {
    Flux<Long> flux = Flux.interval(Duration.ofMillis(10)).take(100);
    StepVerifier.create(flux, 1) // Подписчик с буфером 1
        .thenRequest(2)          // Запрашиваем 2 элемента
        .expectNext(0L, 1L)      // Проверяем
        .thenRequest(1)          // Запрашиваем ещё
        .expectNext(2L)
        .thenCancel()            // Отменяем подписку
        .verify();
}
```
**Почему не `.block()`?** Блокировка нарушает неблокирующий контракт, скрывает проблемы с потоками, делает тесты хрупкими. `StepVerifier` имитирует реального подписчика, проверяет backpressure и терминальность.

### 10.2. `BlockHound`: детекция скрытых блокировок
Инструмент байткод-инструментации, который патчит `java.lang.Thread`, `java.util.concurrent`, `Files`, `System.in/out` на старте JVM. Перед каждым потенциально блокирующим вызовом проверяет контекст потока. Если поток принадлежит реактивному пулу (`parallel`, `elastic`), выбрасывает `BlockingOperationError` с полным стектрейсом.

**Интеграция**
```java
static { BlockHound.install(); } // В тестовом классе или @BeforeAll
```
Типичные скрытые блокировки: `Thread.sleep()`, `synchronized`, `RestTemplate`, `JDBC`, `InetAddress.getLocalHost()`, `SecureRandom`.

### 10.3. Интеграционное тестирование с `WebTestClient`
```java
@WebFluxTest(controllers = UserController.class)
class UserControllerTest {
    @Autowired private WebTestClient client;
    @MockBean private UserService service;

    @Test
    void shouldReturnUser() {
        when(service.findById(1L)).thenReturn(Mono.just(new User(1L, "Alice")));
        
        client.get().uri("/users/1")
            .exchange()
            .expectStatus().isOk()
            .expectBody(User.class)
            .value(u -> assertEquals("Alice", u.name()));
    }
}
```
`@WebFluxTest` загружает только веб-слой, пропускает автоконфигурацию БД, ускоряет запуск тестов в 5–10 раз по сравнению с `@SpringBootTest`.

### 10.4. Отладка асинхронных цепочек
Стек-трейсы в реактивном коде обрываются на границе потоков. Для восстановления контекста:
```java
// Глобально (dev/test)
Hooks.onOperatorDebug();
// Локально (через Context)
Context.of("traceId", "abc-123")
```
В production используйте Micrometer + Reactor Context + distributed tracing (OpenTelemetry, Brave).

---

## 11. Продвинутые темы и production-готовность

### 11.1. Context Propagation
Реактивный `Context` — иммутабельная map-структура, привязанная к цепочке подписки. Используется для передачи кросс-каттинг данных без изменения сигнатур методов:
```java
Mono<User> result = userService.findById(id)
    .contextWrite(ctx -> ctx.put("tenantId", "org-42"))
    .contextWrite(ctx -> ctx.put("traceId", MDC.get("traceId")));
```
В Spring 6 / Reactor 3.5+ интегрирован с `ContextSnapshot` и виртуальными потоками для автоматической миграции MDC/Tracing.

### 11.2. Виртуальные потоки (Java 21+)
`boundedElastic()` теперь использует `Executors.newVirtualThreadPerTaskExecutor()`. Виртуальные потоки:
- управляются JVM, а не ОС;
- имеют стек ~2 КБ (растёт динамически);
- позволяют писать блокирующий код в реактивном стиле без `subscribeOn` в простых сценариях;
- **не отменяют backpressure**: Reactor всё ещё контролирует `request(n)`, но теперь не нужен отдельный worker-пул.

### 11.3. Connection Pooling & Resource Management
- **R2DBC**: используй `ConnectionPool` (HikariCP не совместим с неблокирующим стеком).
- **WebClient**: настрой `ConnectionProvider` (max connections, pending acquire timeout, max idle time).
- **Sinks**: для горячей эмиссии используй `Sinks.many().multicast().onBackpressureBuffer()` или `unicast()`.

---

## 12. Итоговые выводы и архитектурные рекомендации

1. **Reactive Streams — спецификация, Reactor — реализация.** Интерфейсы гарантируют контракт, Reactor даёт инструменты для production.
2. **Backpressure — не опция, а гарантия устойчивости**. Позволяет системам деградировать gracefully, а не падать с OOM.
3. **Никогда не блокируй Event Loop.** `Thread.sleep()`, JDBC, синхронные HTTP в обработчике останавливают диспетчер. Для legacy используй `boundedElastic()` или миграцию на R2DBC/WebClient.
4. **WebFlux оправдан для I/O-bound нагрузок.** Высокая concurrency, стриминг, API-шлюзы, SSE/WebSockets. Для CPU-heavy или простого CRUD выбирай Spring MVC.
5. **Тестирование требует дисциплины.** `StepVerifier` вместо `.block()`, `BlockHound` в CI, `Hooks.onOperatorDebug()` в dev, Context для трассировки.
6. **Реактивность — это культура, а не библиотека**. Требует понимания асинхронности, управления ресурсами, мониторинга latency-/throughput-/backpressure-метрик. Внедряй постепенно: начни с WebClient, затем сервисный слой, затем БД.

Реактивный стек — мощный инструмент для современных распределённых систем. При грамотном применении он даёт предсказуемую задержку, линейное масштабирование и устойчивость к пиковым нагрузкам. При игнорировании принципов (скрытые блокировки, игнор backpressure) становится источником трудноуловимых production-инцидентов.
