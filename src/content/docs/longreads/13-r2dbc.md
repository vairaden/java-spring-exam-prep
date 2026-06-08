---
title: "Лонгрид 13. Асинхронная работа с БД. R2DBC"
description: "Реактивный доступ к БД, проблема блокировки потоков"
---

## 1. Введение: почему реактивный веб без реактивной БД не масштабируется

### 1.1. Постановка проблемы

Представим типичный реактивный контроллер:

```java
@RestController
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    @GetMapping("/orders/{id}")
    public Mono<OrderDto> getOrder(@PathVariable Long id) {
        return orderService.findById(id);
    }
}
```

Внешне всё выглядит реактивно. Но если `OrderService` внутри вызывает `JpaRepository.findById(id)` — мы получаем **блокирующий вызов внутри реактивного pipeline**. Это не просто «неэффективно» — это **катастрофа для Event Loop**.

### 1.2. Анатомия проблемы

Netty по умолчанию использует `N` Event Loop потоков (обычно `N = Runtime.getRuntime().availableProcessors()`). Каждый из них обслуживает тысячи соединений. Если один из этих потоков заблокируется на JDBC-вызове (а это 1–100 мс для типичного запроса), он **перестаёт обслуживать все свои соединения**.

### 1.3. Количественная оценка

Допустим:
- 4 потока Event Loop (4-ядерный сервер);
- среднее время JDBC-запроса: 20 мс;
- все запросы идут в БД.

**Максимальная пропускная способность:**

```
4 потока × (1000 мс ÷ 20 мс) = 200 RPS
```

Для реактивного сервера, способного держать десятки тысяч одновременных соединений, 200 RPS — это провал. Мы получили **throughput хуже, чем у классического Tomcat с 200 потоками**.

### 1.4. «А давайте обернём в `subscribeOn(Schedulers.boundedElastic())`?»

Это первое, что приходит в голову:

```java
public Mono<Order> findById(Long id) {
    return Mono.fromCallable(() -> jdbcOrderRepository.findById(id))
               .subscribeOn(Schedulers.boundedElastic())
               .flatMap(opt -> Mono.justOrEmpty(opt));
}
```

Формально это снимает блокировку с Event Loop. Но:

| Аспект | Проблема |
|--------|----------|
| **Потоки** | `boundedElastic` создаёт до 10 × CPU потоков. Мы вернулись к модели thread-per-request |
| **Backpressure** | JDBC не поддерживает backpressure. Если БД медленная — потоки копятся, память растёт |
| **Пул соединений** | HikariCP блокирует поток при ожидании соединения — ещё одна точка блокировки |
| **Контекст** | Reactor Context (в том числе SecurityContext) теряется при переключении на другой Scheduler |
| **Мониторинг** | BlockHound не ловит блокировку, потому что она «легальна» на boundedElastic, но проблема остаётся |

**Вывод**: `subscribeOn(boundedElastic)` — это **костыль**, а не решение. Мы не получаем ни настоящей реактивности, ни backpressure, ни эффективного использования ресурсов. Это допустимо как **временная мера при миграции**, но не как целевая архитектура.

### 1.5. Что значит «реактивная БД»?

Для полноценной реактивной работы с базой данных нужно, чтобы **весь путь от приложения до сетевого сокета БД** был неблокирующим:

```
Reactor Pipeline
    → R2DBC SPI
        → Vendor Driver (неблокирующий I/O)
            → TCP Socket (NIO / Netty)
                → PostgreSQL / MySQL / ...
```

Ни на одном из этих уровней не должно быть `synchronized`, `wait()`, `Thread.sleep()` или блокирующего чтения из `InputStream`.

---

## 2. Проблемы JDBC/Hibernate в реактивном стеке

### 2.1. Сквозной пример: синхронный сервис заказов

Начнём с классического варианта, который мы будем эволюционировать.

**Зависимости (build.gradle.kts)**

```kotlin
dependencies {
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-web")
    runtimeOnly("org.postgresql:postgresql")
}
```

**Сущность**

```java
@Entity
@Table(name = "orders")
public class Order {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String customerName;

    @Column(nullable = false)
    private BigDecimal amount;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private OrderStatus status;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    // конструкторы, геттеры, сеттеры
}

public enum OrderStatus {
    CREATED, CONFIRMED, SHIPPED, DELIVERED, CANCELLED
}
```

**Репозиторий**

```java
public interface OrderRepository extends JpaRepository<Order, Long> {
    List<Order> findByStatus(OrderStatus status);
    List<Order> findByCustomerName(String customerName);
}
```

**Сервис**

```java
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;

    public Order findById(Long id) {
        return orderRepository.findById(id)
                .orElseThrow(() -> new OrderNotFoundException(id));
    }

    @Transactional
    public Order create(CreateOrderRequest request) {
        var order = new Order();
        order.setCustomerName(request.customerName());
        order.setAmount(request.amount());
        order.setStatus(OrderStatus.CREATED);
        order.setCreatedAt(LocalDateTime.now());
        return orderRepository.save(order);
    }

    @Transactional
    public Order confirm(Long id) {
        var order = findById(id);
        if (order.getStatus() != OrderStatus.CREATED) {
            throw new IllegalStateException("Cannot confirm order in status: " + order.getStatus());
        }
        order.setStatus(OrderStatus.CONFIRMED);
        return orderRepository.save(order);
    }
}
```

Этот код работает прекрасно в Spring MVC. Теперь разберём, **почему он фундаментально несовместим с реактивным стеком**.

### 2.2. Семь фундаментальных проблем JDBC в реактивном контексте

#### Проблема 1: блокирующий I/O на уровне протокола

JDBC API спроектирован синхронно. Метод `Statement.execute()` блокирует вызывающий поток до получения ответа от БД:

```java
// Внутри PostgreSQL JDBC Driver (упрощённо):
public ResultSet executeQuery(String sql) throws SQLException {
    sendQuery(sql);                    // запись в сокет
    return readResponse();             // ← БЛОКИРУЮЩЕЕ чтение из InputStream
}
```

`readResponse()` вызывает `InputStream.read()`, который блокирует поток ОС. Это **не вопрос API-дизайна** — это фундаментальное свойство JDBC.

#### Проблема 2: отсутствие backpressure

Когда JDBC возвращает `ResultSet`, весь результат (или его fetch-порция) уже прочитан из сокета в память. Клиент не может сказать серверу «подожди, я не успеваю обрабатывать».

```java
ResultSet rs = stmt.executeQuery("SELECT * FROM orders"); // миллион строк
while (rs.next()) {
    // все строки уже в буфере драйвера или будут прочитаны блоками
    // нет механизма «я хочу следующие 10, когда буду готов»
}
```

В реактивном мире `Flux<Order>` с backpressure означает «подписчик запросил 10 элементов — драйвер прочитал ровно 10 строк из сокета». JDBC так не умеет.

#### Проблема 3: thread-affinity соединений

JDBC-соединение привязано к потоку. `Connection`, `Statement`, `ResultSet` — всё это **не thread-safe**. Типичный паттерн:

```
Thread-1: connection.setAutoCommit(false)
Thread-1: stmt.executeUpdate("INSERT ...")
Thread-1: stmt.executeUpdate("UPDATE ...")
Thread-1: connection.commit()
```

В реактивном мире один запрос может обрабатываться на разных потоках (после каждого асинхронного шага Reactor может переключить поток). Это **несовместимо** с JDBC-транзакциями.

#### Проблема 4: пул соединений блокирует при ожидании

HikariCP — лучший пул для JDBC. Но когда все соединения заняты:

```java
// HikariPool.java (упрощённо):
public Connection getConnection(long timeout) throws SQLException {
    PoolEntry entry = connectionBag.borrow(timeout, MILLISECONDS);
    // ← Thread.park() / wait() — БЛОКИРОВКА
    if (entry == null) throw new SQLTransientConnectionException("Connection not available");
    return entry.connection;
}
```

Вызов `getConnection()` блокирует поток. Если это поток Event Loop — катастрофа.

#### Проблема 5: Hibernate Session и Lazy Loading

Hibernate Session хранит persistence context, dirty checking, lazy-loading-прокси. Всё это:
- привязано к одному потоку;
- требует открытого JDBC-соединения для lazy loading;
- использует `synchronized` блоки внутри.

```java
order.getItems().size(); // ← Lazy load → JDBC запрос → блокировка
```

В реактивном pipeline lazy loading — это **скрытая блокировка**, которую даже BlockHound может не поймать, если она происходит на «разрешённом» потоке.

#### Проблема 6: `@Transactional` через ThreadLocal

Spring `@Transactional` хранит транзакционный контекст в `ThreadLocal`:

```java
// TransactionSynchronizationManager.java
private static final ThreadLocal<Map<Object, Object>> resources =
    new NamedThreadLocal<>("Transactional resources");
```

В реактивном стеке поток меняется после каждого асинхронного шага. `ThreadLocal` теряется. Поэтому `@Transactional` **не работает** с реактивными методами, возвращающими `Mono`/`Flux`.

#### Проблема 7: mismatch жизненного цикла

| Аспект | JDBC/JPA | Реактивный стек |
|--------|----------|-----------------|
| Модель выполнения | 1 поток = 1 запрос | N потоков обслуживают M запросов |
| Управление соединением | Взял → использовал → вернул (в рамках потока) | Взял → отправил запрос → отпустил поток → получил ответ → вернул соединение |
| Транзакции | ThreadLocal | Reactor Context |
| Обработка результатов | Pull (rs.next()) | Push (onNext()) |
| Отмена | Нет стандартного механизма | Cancellation propagation |

### 2.3. Демонстрация проблемы: BlockHound в действии

Если мы попытаемся использовать JPA в реактивном контексте и включим BlockHound, он немедленно покажет проблему.

**Добавим зависимость BlockHound (build.gradle.kts)**

```kotlin
testImplementation("io.projectreactor.tools:blockhound:1.0.9.RELEASE")
```

**Активация в main-классе**

```java
public static void main(String[] args) {
    BlockHound.install();
    SpringApplication.run(OrderApplication.class, args);
}
```

**Попытка обернуть JPA-вызов в Mono**

```java
@Service
@RequiredArgsConstructor
public class OrderServiceHybrid {

    private final OrderRepository orderRepository; // JpaRepository

    public Mono<Order> findById(Long id) {
        return Mono.defer(() -> {
            Order order = orderRepository.findById(id)
                    .orElseThrow(() -> new OrderNotFoundException(id));
            return Mono.just(order);
        });
    }
}
```

**Что произойдёт при вызове из WebFlux-контроллера**

```
reactor.blockhound.BlockingOperationError: 
    Blocking call! java.io.InputStream.read
    at java.base/java.io.InputStream.read(InputStream.java)
    at org.postgresql.core.PGStream.receive(PGStream.java:...)
    at org.postgresql.core.v3.QueryExecutorImpl.processResults(...)
    at org.postgresql.jdbc.PgStatement.executeInternal(...)
    ...
    at reactor.core.publisher.MonoDefer.subscribe(MonoDefer.java:45)
    at reactor-http-nio-2  ← ЭТО EVENT LOOP ПОТОК!
```

BlockHound ловит блокирующий вызов `InputStream.read()` на потоке `reactor-http-nio-2` (Event Loop). Это **именно та ситуация**, которую мы описали в разделе 1.

> **💡 Важно для студентов**: BlockHound НЕ поймает блокировку, если вы обернёте вызов в `subscribeOn(Schedulers.boundedElastic())`, потому что `boundedElastic` — это пул потоков, на которых блокировка «разрешена». Но проблема эффективности никуда не денется.

---

## 3. Эволюция асинхронности в Java: от @Async до Reactive Drivers

Прежде чем перейти к R2DBC, важно понять весь спектр подходов к асинхронной работе с данными в Java и то, почему каждый предыдущий шаг оказался недостаточным.

### 3.1. Подход 1: `@Async` + Spring (2009+)

Самый простой способ «не блокировать вызывающий поток»:

```java
@Service
public class OrderServiceAsync {

    @Autowired
    private OrderRepository orderRepository;

    @Async("dbTaskExecutor")
    public CompletableFuture<Order> findById(Long id) {
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new OrderNotFoundException(id));
        return CompletableFuture.completedFuture(order);
    }
}

@Configuration
@EnableAsync
public class AsyncConfig {

    @Bean("dbTaskExecutor")
    public Executor dbTaskExecutor() {
        var executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(10);
        executor.setMaxPoolSize(50);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("db-async-");
        return executor;
    }
}
```

**Как это работает**

```
Caller Thread ──[вызов findById()]──▶ возвращает CompletableFuture сразу
                                      │
db-async-1 ──[JDBC getConnection]──[execute]──[read]──[complete future]──▶
```

**Проблемы**

| Аспект | Оценка |
|--------|--------|
| Блокировка Event Loop |  Решена — блокируется отдельный пул |
| Потребление потоков |  1 поток на 1 запрос к БД |
| Backpressure | Нет. Очередь `queueCapacity` — единственный ограничитель |
| Масштабируемость |  Ограничена размером пула потоков |
| Composability |  `CompletableFuture` композируется, но хуже, чем Reactor |
| Транзакции |️ Работают, но `@Transactional` + `@Async` на одном методе — **не работает** (прокси-конфликт) |

**Типичная ошибка студентов**

```java
@Async
@Transactional  // ← НЕ РАБОТАЕТ! @Async выполняется в другом потоке,
                //   @Transactional привязывает контекст к текущему потоку
public CompletableFuture<Order> createAndConfirm(CreateOrderRequest req) {
    Order order = orderRepository.save(mapToEntity(req));
    order.setStatus(OrderStatus.CONFIRMED);
    return CompletableFuture.completedFuture(orderRepository.save(order));
}
```

Spring создаёт два прокси: один для `@Async`, другой для `@Transactional`. `@Async`-прокси перехватывает вызов первым и запускает метод в другом потоке, где `@Transactional`-прокси создаёт **новую** транзакцию. Если вызывающий код ожидал, что всё будет в одной транзакции с другими операциями, — это ошибка.

### 3.2. Подход 2: `CompletableFuture` + ручное управление (2014+, Java 8)

Более гибкий вариант без магии `@Async`:

```java
@Service
@RequiredArgsConstructor
public class OrderServiceCF {

    private final OrderRepository orderRepository;
    private final Executor dbExecutor;

    public CompletableFuture<Order> findById(Long id) {
        return CompletableFuture.supplyAsync(
            () -> orderRepository.findById(id)
                    .orElseThrow(() -> new OrderNotFoundException(id)),
            dbExecutor
        );
    }

    public CompletableFuture<Order> createAndNotify(CreateOrderRequest req) {
        return CompletableFuture
            .supplyAsync(() -> {
                var order = new Order();
                order.setCustomerName(req.customerName());
                order.setAmount(req.amount());
                order.setStatus(OrderStatus.CREATED);
                order.setCreatedAt(LocalDateTime.now());
                return orderRepository.save(order);
            }, dbExecutor)
            .thenApplyAsync(order -> {
                // отправка уведомления (тоже может быть блокирующей)
                notificationService.notify(order);
                return order;
            }, notificationExecutor);
    }
}
```

**Улучшения по сравнению с `@Async`**
- Явное управление пулами потоков.
- Композиция через `thenApply`, `thenCompose`, `thenCombine`.
- Можно комбинировать разные Executor'ы.

**Оставшиеся проблемы**
- Всё ещё thread-per-request для БД-операций.
- Нет backpressure.
- Обработка ошибок через `exceptionally()`/`handle()` — менее выразительна, чем Reactor.
- `CompletableFuture` — eager (выполнение начинается сразу), а не lazy как `Mono`.

### 3.3. Подход 3: Virtual Threads (2023+, Java 21)

Java 21 принесла Virtual Threads (Project Loom) — **революционное изменение**, которое заслуживает детального разбора.

**Зависимости — те же, что и для обычного Spring MVC. Изменяется только конфигурация.**

```yaml
# application.yml — Spring Boot 3.2+
spring:
  threads:
    virtual:
      enabled: true
```

Наш сервис остаётся ПОЛНОСТЬЮ СИНХРОННЫМ:

```java
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class OrderServiceVT {

    private final OrderRepository orderRepository;

    public Order findById(Long id) {
        return orderRepository.findById(id)
                .orElseThrow(() -> new OrderNotFoundException(id));
    }

    @Transactional
    public Order create(CreateOrderRequest request) {
        var order = new Order();
        order.setCustomerName(request.customerName());
        order.setAmount(request.amount());
        order.setStatus(OrderStatus.CREATED);
        order.setCreatedAt(LocalDateTime.now());
        return orderRepository.save(order);
    }
}
```

**Как это работает под капотом**

```
Carrier Thread (platform, ForkJoinPool):
    ├── VT-1: ──[handle request]──[JDBC call]──️ (unmount)
    ├── VT-2: ──[handle request]──[processing]──▶
    ├── VT-3: ──[handle request]──[JDBC call]──️ (unmount)
    └── VT-4: ──[handle request]──[response]──▶

Когда JDBC-вызов VT-1 завершается:
    VT-1: ── (remount на любой carrier)──[продолжение]──▶
```

Virtual Thread при блокирующем I/O **отмонтируется** от carrier-потока (platform thread), освобождая его для других virtual threads. Когда I/O завершается, virtual thread монтируется обратно (возможно, на другой carrier).


**Ограничения Virtual Threads (критически важно!)**

```java
// ПРОБЛЕМА 1: synchronized блоки «пиннят» virtual thread к carrier
synchronized (lock) {
    connection.executeQuery(sql); // ← VT НЕ отмонтируется!
    // carrier thread заблокирован
}

// РЕШЕНИЕ: использовать ReentrantLock либо Java24+
private final ReentrantLock lock = new ReentrantLock();

lock.lock();
try {
    connection.executeQuery(sql); // ← VT отмонтируется нормально
} finally {
    lock.unlock();
}
```

**Проблема pinning в JDBC-драйверах**

Многие JDBC-драйверы (включая PostgreSQL до версии 42.7.0) используют `synchronized` внутри. Это вызывает **pinning** — virtual thread не может отмонтироваться от carrier.

```
# Диагностика pinning (JVM flag):
-Djdk.tracePinnedThreads=short

# Вывод:
Thread[#37,ForkJoinPool-1-worker-1,5,CarrierThreads]
    java.base/java.lang.VirtualThread$VThreadContinuation.onPinned(VirtualThread.java:183)
    org.postgresql.core.v3.QueryExecutorImpl.execute(QueryExecutorImpl.java:...)
    <== monitors:1
```

> **Важно**: PostgreSQL JDBC Driver 42.7.0+ (декабрь 2023) убрал большинство блоков `synchronized`. MySQL Connector/J 8.2.0+ тоже. **Всегда проверяй версию драйвера при использовании Virtual Threads.**

**Зависимость для PostgreSQL с поддержкой Virtual Threads:**

```kotlin
runtimeOnly("org.postgresql:postgresql:42.7.4") // ≥ 42.7.0!
```

### 3.4. Подход 4: Reactive Drivers (R2DBC)

Наконец, полностью неблокирующий подход:

```java
@Service
@RequiredArgsConstructor
public class OrderServiceReactive {

    private final OrderReactiveRepository orderRepository;

    public Mono<Order> findById(Long id) {
        return orderRepository.findById(id)
                .switchIfEmpty(Mono.error(new OrderNotFoundException(id)));
    }

    public Flux<Order> findByStatus(OrderStatus status) {
        return orderRepository.findByStatus(status);
    }
}
```

Здесь **ни один поток не блокируется** — ни при отправке запроса, ни при чтении результатов, ни при ожидании соединения из пула.

### 3.5. Сравнительная таблица подходов

| Критерий | @Async | CompletableFuture | Virtual Threads | R2DBC |
|----------|--------|-------------------|-----------------|-------|
| **Блокировка Event Loop** |   Нет |   Нет |   Нет |   Нет |
| **Потребление потоков** |   1 : 1 |   1 : 1 |   Миллионы VT |   Несколько EL |
| **Backpressure** |   |   |   |   |
| **Совместимость с JPA** |   |   |   |   |
| **Сложность кода** | Низкая | Средняя | **Минимальная** | Высокая |
| **Сложность отладки** | Средняя | Средняя | Низкая | Высокая |
| **Зрелость экосистемы** | Высокая | Высокая | Растёт | Средняя |
| **Производительность (I/O-bound)** | Средняя | Средняя | Высокая | Высокая |
| **Производительность (CPU-bound)** | Средняя |
| **Производительность (CPU-bound)** | Средняя | Средняя | Средняя | Средняя |
| **Реактивный стек (WebFlux)** |  Костыль |  ️ Костыль |  ️ Мismatch парадигм |   Нативно |
| **Транзакции** |  ️ Сложно |  ️ Вручную |   @Transactional |   TransactionalOperator |
| **Memory footprint на 10K конкурентных запросов** | ~10 GB (10K platform threads) | ~10 GB | ~50 MB (10K virtual threads) | ~30MB |

### 3.6. Когда какой подход выбирать?

```
                    ┌─────────────────────────────────────┐
                    │ Нужен реактивный стек (WebFlux)?     │
                    └───────────┬──────────┬──────────────┘
                               Да         Нет
                                │          │
                    ┌───────────▼──┐  ┌────▼──────────────────┐
                    │ Нужен         │  │ Java 21+?             │
                    │ backpressure  │  └───┬──────────┬────────┘
                    │ от БД?        │     Да         Нет
                    └──┬───────┬───┘      │          │
                      Да     Нет     ┌────▼────┐  ┌──▼───────────┐
                       │      │      │ Virtual  │  │ @Async /     │
                  ┌────▼──┐ ┌─▼────┐ │ Threads  │  │ CompletableF │
                  │ R2DBC │ │ VT + │ │ + JDBC   │  │ + JDBC       │
                  │       │ │WebFlux│ └──────────┘  └──────────────┘
                  └───────┘ └──────┘
```

> **💡 Ключевой вывод**: Virtual Threads — отличный выбор для **нового** проекта на Spring MVC с JDBC/JPA. R2DBC — выбор для **полностью реактивного** стека, где нужен end-to-end backpressure и максимальная эффективность I/O.

---

## 4. R2DBC: спецификация, архитектура, неблокирующий I/O

### 4.1. Что такое R2DBC

**R2DBC (Reactive Relational Database Connectivity)** — это спецификация (SPI), определяющая неблокирующий API для работы с реляционными базами данных. Это **не замена JDBC**, а альтернативный стандарт для реактивных приложений.

**Ключевые принципы**
- **Полностью неблокирующий** — от API до сетевого уровня.
- **Reactive Streams** — встроенный backpressure через Publisher/Subscriber.
- **Минимальный SPI** — драйвер реализует минимум интерфейсов, остальное — клиентские библиотеки.
- **Нет ORM** — R2DBC работает на уровне SQL, без entity mapping (маппинг делает Spring Data R2DBC).

Спецификация (r2dbc-spi) определяет интерфейсы:

```java
// Основные интерфейсы R2DBC SPI:
public interface ConnectionFactory {
    Publisher<? extends Connection> create();
    ConnectionFactoryMetadata getMetadata();
}

public interface Connection extends Closeable {
    Publisher<Void> beginTransaction();
    Publisher<Void> commitTransaction();
    Publisher<Void> rollbackTransaction();
    Publisher<Void> close();
    Statement createStatement(String sql);
    // ...
}

public interface Statement {
    Statement bind(int index, Object value);
    Statement bind(String name, Object value);
    Publisher<? extends Result> execute();
}

public interface Result {
    Publisher<Long> getRowsUpdated();
    <T> Publisher<T> map(BiFunction<Row, RowMetadata, T> mappingFunction);
}
```

Обрати внимание: **каждый метод возвращает `Publisher`** (Reactive Streams). Ни один метод не блокирует.

### 4.2. Доступные драйверы

| База данных | Драйвер | Артефакт | Зрелость |
|-------------|---------|----------|----------|
| PostgreSQL | r2dbc-postgresql | `org.postgresql:r2dbc-postgresql:1.0.5.RELEASE` |   Production |
| PostgreSQL | r2dbc-postgresql (новый) | `io.r2dbc:r2dbc-postgresql` (deprecated → перешёл в org.postgresql) | Миграция |
| MySQL | r2dbc-mysql (jasync) | `io.asyncer:r2dbc-mysql:1.1.3` |   Production |
| MariaDB | r2dbc-mariadb | `org.mariadb:r2dbc-mariadb:1.2.2` |   Production |
| MS SQL | r2dbc-mssql | `io.r2dbc:r2dbc-mssql:1.0.2.RELEASE` |   Production |
| H2 | r2dbc-h2 | `io.r2dbc:r2dbc-h2:1.0.0.RELEASE` |   Тесты |
| Oracle | oracle-r2dbc | `com.oracle.database.r2dbc:oracle-r2dbc:1.2.0` |   Production |

### 4.3. Архитектура: как драйвер реализует неблокирующий I/O

Рассмотрим на примере `r2dbc-postgresql`. Это **ключевой** раздел для понимания того, почему R2DBC действительно неблокирующий.

> **Архитектура R2DBC-драйвера (PostgreSQL)**
>
> ```
> ┌─────────────────────────────────────────────────────────────────┐
> │                     Твоё приложение                             │
> │  Mono<Order> = repository.findById(1)                          │
> └─────────────────────┬─────────────────────────────────────────┘
>                       │ subscribe()
>                       ▼
> ┌─────────────────────────────────────────────────────────────────┐
> │                   Spring Data R2DBC                             │
> │  SQL генерация, маппинг Row → Entity, транзакции               │
> └─────────────────────┬─────────────────────────────────────────┘
>                       │ Statement.execute() → Publisher<Result>
>                       ▼
> ┌─────────────────────────────────────────────────────────────────┐
> │                   R2DBC SPI (r2dbc-spi)                        │
> │  Connection, Statement, Result, Row — интерфейсы               │
> └─────────────────────┬─────────────────────────────────────────┘
>                       │
>                       ▼
> ┌─────────────────────────────────────────────────────────────────┐
> │              r2dbc-postgresql Driver                            │
> │                                                                 │
> │  ┌──────────────┐  ┌───────────────────┐  ┌────────────────┐  │
> │  │ PostgreSQL   │  │  Message Codec     │  │ Flow Control   │  │
> │  │ Protocol     │  │  (Encode/Decode    │  │ (backpressure  │  │
> │  │ State Machine│  │   FE/BE messages)  │  │  Reactive      │  │
> │  │              │  │                    │  │  Streams)      │  │
> │  └──────┬───────┘  └────────┬──────────┘  └───────┬────────┘  │
> │         │                   │                      │           │
> │         └───────────────────┼──────────────────────┘           │
> │                             │                                   │
> │                    ┌────────▼────────┐                          │
> │                    │   Reactor Netty  │                          │
> │                    │   TcpClient      │                          │
> │                    └────────┬────────┘                          │
> └────────────────────────────┼──────────────────────────────────┘
>                              │ Non-blocking TCP
>                              ▼
>                    ┌──────────────────┐
>                    │   PostgreSQL DB   │
>                    │   (port 5432)     │
>                    └──────────────────┘
> ```

**Ключевые компоненты:**

#### 4.3.1. Reactor Netty TcpClient

Драйвер `r2dbc-postgresql` использует **Reactor Netty** для TCP-коммуникации. Это тот же Netty, что обслуживает HTTP в WebFlux, но для PostgreSQL wire protocol:

```java
// Внутри драйвера (упрощённо):
TcpClient tcpClient = TcpClient.create()
    .host("localhost")
    .port(5432)
    .runOn(LoopResources.create("r2dbc-pg", 4, true)); // свой EventLoopGroup!
```

Важный нюанс: драйвер создаёт **собственный EventLoopGroup**, отдельный от HTTP EventLoopGroup Netty. Это значит, что I/O операции с БД не конкурируют с HTTP I/O за одни и те же потоки.

#### 4.3.2. PostgreSQL Wire Protocol

PostgreSQL использует бинарный протокол с сообщениями (Frontend/Backend messages):

```
Frontend (клиент → сервер):
  - Query ('Q')           — простой запрос
  - Parse ('P')           — подготовка statement
  - Bind ('B')            — привязка параметров
  - Execute ('E')         — выполнение
  - Sync ('S')            — синхронизация pipeline

Backend (сервер → клиент):
  - RowDescription ('T')  — описание колонок
  - DataRow ('D')         — строка данных
  - CommandComplete ('C') — завершение команды
  - ReadyForQuery ('Z')   — готов к следующему запросу
  - ErrorResponse ('E')   — ошибка
```

R2DBC-драйвер кодирует/декодирует эти сообщения **асинхронно** через Netty pipeline:

```java
// Упрощённая схема Netty pipeline в драйвере:
channel.pipeline()
    .addLast(new LengthFieldBasedFrameDecoder(...))  // фрейминг
    .addLast(new BackendMessageDecoder())             // декодирование PG-сообщений
    .addLast(new FrontendMessageEncoder())            // кодирование запросов
    .addLast(new ReactorNettyBridge());               // мост к Reactor Publishers
```

#### 4.3.3. Как работает backpressure до базы данных

Это один из самых важных и часто непонятых аспектов R2DBC.

**Уровень 1: reactor → драйвер**

Когда подписчик запрашивает `request(10)`, драйвер знает, что нужно обработать не более 10 строк. Но PostgreSQL **не поддерживает row-level flow control** в стандартном протоколе — сервер отправляет все строки результата.

**Уровень 2: драйвер → буфер TCP**

Backpressure реализуется через **TCP flow control**:

```
Подписчик: request(10)
    │
    ▼
Драйвер: читает 10 строк из Netty ByteBuf
    │
    ▼
Драйвер: ПЕРЕСТАЁТ читать из TCP сокета (autoRead = false)
    │
    ▼
TCP receive buffer: заполняется
    │
    ▼
TCP window: уменьшается → 0
    │
    ▼
PostgreSQL: TCP send buffer полон → сервер приостанавливает отправку
```

Таким образом, backpressure **пробрасывается через TCP** до самого сервера БД. Сервер физически не может отправить больше данных, чем клиент готов принять.

```java
// Пример: backpressure в действии
orderRepository.findAll()  // Flux<Order> — потенциально миллион строк
    .buffer(100)           // обрабатываем по 100
    .delayElements(Duration.ofMillis(50))  // имитация медленной обработки
    .flatMap(batch -> processBatch(batch), 4)
    .subscribe();

// Драйвер НЕ вычитает все строки в память!
// Он читает порциями, синхронизируясь с demand от подписчика
```

### 4.4. Пул соединений: r2dbc-pool

**Почему нельзя использовать HikariCP с R2DBC?**

HikariCP — блокирующий пул. Его метод `getConnection()` вызывает `Thread.park()` при ожидании свободного соединения. Это **убивает Event Loop**.

```java
// HikariCP (блокирующий):
Connection conn = hikariDataSource.getConnection(); // ← может заблокировать поток

// r2dbc-pool (неблокирующий):
Mono<Connection> conn = connectionPool.create(); // ← возвращает Mono, НИКОГДА не блокирует
```

**Как r2dbc-pool управляет соединениями:**

**Зависимость (добавляется автоматически через spring-boot-starter-data-r2dbc)**

```kotlin
implementation("io.r2dbc:r2dbc-pool:1.0.1.RELEASE")
```

**Конфигурация**

```yaml
spring:
  r2dbc:
    url: r2dbc:pool:postgresql://localhost:5432/orders_db
    username: app_user
    password: ${DB_PASSWORD}
    pool:
      initial-size: 5
      max-size: 20
      max-idle-time: 30m
      max-life-time: 60m
      max-acquire-time: 5s
      max-create-connection-time: 10s
      validation-query: "SELECT 1"
      validation-depth: REMOTE
```

**Или программная конфигурация (для тонкой настройки)**

```java
@Configuration
public class R2dbcConfig {

    @Bean
    public ConnectionPool connectionPool() {
        var connectionFactory = PostgresqlConnectionFactory.from(
            PostgresqlConnectionConfiguration.builder()
                .host("localhost")
                .port(5432)
                .database("orders_db")
                .username("app_user")
                .password(System.getenv("DB_PASSWORD"))
                .build()
        );

        var poolConfig = ConnectionPoolConfiguration.builder(connectionFactory)
                .initialSize(5)
                .maxSize(20)
                .maxIdleTime(Duration.ofMinutes(30))
                .maxLifeTime(Duration.ofMinutes(60))
                .maxAcquireTime(Duration.ofSeconds(5))
                .maxCreateConnectionTime(Duration.ofSeconds(10))
                .validationQuery("SELECT 1")
                .validationDepth(ValidationDepth.REMOTE)
                .metricsRecorder(new MicrometerR2dbcPoolMetricsRecorder(meterRegistry))
                .build();

        return new ConnectionPool(poolConfig);
    }
}
```

**Как r2dbc-pool работает внутри (без блокировок)**

```
Mono<Connection> = pool.create()
    │
    ▼ subscribe()
    │
    ├── Есть свободное соединение в пуле?
    │     ├── Да → onNext(connection) немедленно
    │     └── Нет → Пул полон?
    │           ├── Нет → создать новое соединение (async TCP connect)
    │           │         onNext(connection) когда TCP handshake завершён
    │           └── Да → Поставить запрос в ОЧЕРЕДЬ (Reactor Sinks.Many)
    │                    Когда кто-то вернёт соединение:
    │                    очередь.tryEmitNext(connection)
    │                    │
    │                    ▼ Если maxAcquireTime истёк:
    │                    onError(R2dbcTimeoutException)
    │
    ▼ Использование соединения
    │
    connection.close() → НЕ закрывает TCP!
                       → возвращает в пул
                       → если есть ожидающие в очереди → отдать им
```

> **R2dbc-pool: жизненный цикл соединения**
>
> ```
> ┌─────────────────────────────────────────────────────────┐
> │                    ConnectionPool                        │
> │                                                         │
> │  ┌─────────┐  ┌─────────┐  ┌─────────┐                │
> │  │ Conn #1 │  │ Conn #2 │  │ Conn #3 │  ... (maxSize) │
> │  │  IDLE   │  │ IN_USE  │  │  IDLE   │                │
> │  └────┬────┘  └─────────┘  └────┬────┘                │
> │       │                         │                       │
> │  ┌────▼─────────────────────────▼────┐                 │
> │  │      Idle Connection Queue         │                 │
> │  └────────────────┬──────────────────┘                 │
> │                   │                                     │
> │  ┌────────────────▼──────────────────┐                 │
> │  │   Pending Acquire Queue (Sinks)    │                 │
> │  │   [Subscriber-A, Subscriber-B]     │                 │
> │  └───────────────────────────────────┘                 │
> └─────────────────────────────────────────────────────────┘
>
> pool.create().subscribe(subscriberA):
>   → idle queue не пуст → забрать Conn #1 → subscriberA.onNext(Conn#1)
>
> pool.create().subscribe(subscriberB):
>   → idle queue пуст, pool full → subscriberB в Pending Queue
>   → Conn #1 возвращён → subscriberB.onNext(Conn#1)
> ```

**Сравнение HikariCP и r2dbc-pool**

| Аспект | HikariCP | r2dbc-pool |
|--------|----------|------------|
| Ожидание соединения | `Thread.park()` — блокировка | `Sinks.Many` — реактивная очередь |
| Валидация | `SELECT 1` синхронно | `SELECT 1` асинхронно |
| Eviction (удаление старых) | Фоновый поток `HouseKeeper` | Reactor `Scheduler` + `Flux.interval` |
| Метрики | Micrometer (синхронный сбор) | Micrometer (реактивный сбор) |
| Потребление потоков | 1 поток HouseKeeper + блокировка вызывающих | 0 дополнительных потоков |
| Thread-safety | `ConcurrentBag` + `synchronized` | Lock-free через Reactor operators |

---

## 5. Spring Data R2DBC на практике

### 5.1. Настройка проекта

Теперь трансформируем наш сквозной пример. Полностью заменяем зависимости.

**Было (JDBC/JPA)**

```kotlin
dependencies {
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-web")
    runtimeOnly("org.postgresql:postgresql")
}
```

**Стало (R2DBC/WebFlux)**

```kotlin
dependencies {
    // Реактивный веб
    implementation("org.springframework.boot:spring-boot-starter-webflux")

    // Spring Data R2DBC (включает r2dbc-spi, r2dbc-pool)
    implementation("org.springframework.boot:spring-boot-starter-data-r2dbc")

    // Драйвер PostgreSQL R2DBC
    runtimeOnly("org.postgresql:r2dbc-postgresql:1.0.5.RELEASE")

    // Миграции (Flyway пока не поддерживает R2DBC — используем JDBC для миграций)
    implementation("org.flywaydb:flyway-core")
    implementation("org.flywaydb:flyway-database-postgresql")
    runtimeOnly("org.postgresql:postgresql:42.7.4") // JDBC-драйвер ТОЛЬКО для Flyway

    // Тестирование
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("io.projectreactor:reactor-test")
    testImplementation("io.projectreactor.tools:blockhound:1.0.9.RELEASE")
    testRuntimeOnly("io.r2dbc:r2dbc-h2:1.0.0.RELEASE")
}
```

> **Обрати внимание**: мы добавили JDBC-драйвер PostgreSQL **только для Flyway**. Flyway не поддерживает R2DBC и выполняет миграции через JDBC при старте приложения. Это единственное место, где используется блокирующий драйвер. Spring Boot автоматически создаёт отдельный `DataSource` для Flyway.

**application.yml**

```yaml
spring:
  r2dbc:
    url: r2dbc:postgresql://localhost:5432/orders_db
    username: app_user
    password: ${DB_PASSWORD}
    pool:
      initial-size: 5
      max-size: 20
      max-idle-time: 30m
      max-acquire-time: 5s

  flyway:
    url: jdbc:postgresql://localhost:5432/orders_db
    user: app_user
    password: ${DB_PASSWORD}
    locations: classpath:db/migration

logging:
  level:
    io.r2dbc.postgresql.QUERY: DEBUG    # логирование SQL
    io.r2dbc.postgresql.PARAM: DEBUG    # логирование параметров
    io.r2dbc.pool: DEBUG                # логирование пула
```

### 5.2. Модель данных: Entity без JPA

В R2DBC **нет JPA**. Нет `@Entity`, `@Table`, `@Column` из `javax.persistence`/`jakarta.persistence`. Spring Data R2DBC использует **собственные аннотации**:

```java
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.relational.core.mapping.Table;
import org.springframework.data.relational.core.mapping.Column;

@Table("orders")
public class Order {

    @Id
    private Long id;

    @Column("customer_name")
    private String customerName;

    @Column("amount")
    private BigDecimal amount;

    @Column("status")
    private OrderStatus status;

    @CreatedDate
    @Column("created_at")
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column("updated_at")
    private LocalDateTime updatedAt;

    // Конструктор без аргументов (обязателен для маппинга)
    public Order() {}

    public Order(String customerName, BigDecimal amount, OrderStatus status) {
        this.customerName = customerName;
        this.amount = amount;
        this.status = status;
    }

    // геттеры и сеттеры
    // ...
}
```

**Ключевые отличия от JPA-сущностей**

| Аспект | JPA (@Entity) | Spring Data R2DBC (@Table) |
|--------|---------------|---------------------------|
| Lazy loading |   Поддерживается |   Нет (и не будет) |
| Каскадные операции |   CascadeType.* |   Нет |
| Связи (@OneToMany и так далее) |   Полная поддержка |  ️ Нет автоматического маппинга |
| Dirty checking |   Автоматический |   Нет |
| Schema generation |   ddl-auto |   Нет (используй Flyway/Liquibase) |
| Second-level cache |   Ehcache, Hazelcast |   Нет |
| Определение новой сущности | `@GeneratedValue` | `@Id` == null → INSERT; != null → UPDATE |

**Flyway-миграция (src/main/resources/db/migration/V1__create_orders.sql)**

```sql
CREATE TABLE orders (
    id          BIGSERIAL PRIMARY KEY,
    customer_name VARCHAR(255) NOT NULL,
    amount      DECIMAL(19, 2) NOT NULL,
    status      VARCHAR(50)  NOT NULL DEFAULT 'CREATED',
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP
);

CREATE INDEX idx_orders_status ON orders (status);
CREATE INDEX idx_orders_customer ON orders (customer_name);
```

### 5.3. Реактивный репозиторий

```java
import org.springframework.data.r2dbc.repository.Query;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

public interface OrderRepository extends ReactiveCrudRepository<Order, Long> {

    Flux<Order> findByStatus(OrderStatus status);

    Flux<Order> findByCustomerName(String customerName);

    @Query("SELECT * FROM orders WHERE amount > :minAmount ORDER BY created_at DESC")
    Flux<Order> findExpensiveOrders(BigDecimal minAmount);

    @Query("UPDATE orders SET status = :status WHERE id = :id RETURNING *")
    Mono<Order> updateStatus(Long id, String status);

    // Пагинация — нативная поддержка
    Flux<Order> findByStatusOrderByCreatedAtDesc(OrderStatus status, Pageable pageable);

    // Подсчёт
    Mono<Long> countByStatus(OrderStatus status);

    // Проверка существования
    Mono<Boolean> existsByCustomerNameAndStatus(String customerName, OrderStatus status);
}
```

**Что происходит под капотом при вызове `findByStatus(OrderStatus.CREATED)`**

```
1. Spring Data R2DBC генерирует SQL:
   SELECT id, customer_name, amount, status, created_at, updated_at
   FROM orders
   WHERE status = $1

2. Получает Connection из r2dbc-pool (Mono<Connection>)

3. Создаёт Statement с bind-параметром:
   connection.createStatement(sql).bind("$1", "CREATED")

4. Вызывает statement.execute() → Publisher<Result>

5. Маппит каждый Row → Order через R2dbcConverter

6. Возвращает Flux<Order>

7. При завершении (complete/error/cancel) — возвращает Connection в пул
```

### 5.4. Сервисный слой

```java
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final TransactionalOperator transactionalOperator;

    public Mono<Order> findById(Long id) {
        return orderRepository.findById(id)
                .switchIfEmpty(Mono.error(new OrderNotFoundException(id)));
    }

    public Flux<Order> findByStatus(OrderStatus status) {
        return orderRepository.findByStatus(status);
    }

    public Mono<Order> create(CreateOrderRequest request) {
        var order = new Order(
            request.customerName(),
            request.amount(),
            OrderStatus.CREATED
        );
        return orderRepository.save(order);
    }

    /**
     * Подтверждение заказа — требует транзакции.
     * Читаем заказ, проверяем статус, обновляем.
     */
    public Mono<Order> confirm(Long id) {
        return orderRepository.findById(id)
                .switchIfEmpty(Mono.error(new OrderNotFoundException(id)))
                .flatMap(order -> {
                    if (order.getStatus() != OrderStatus.CREATED) {
                        return Mono.error(new IllegalStateException(
                            "Cannot confirm order in status: " + order.getStatus()));
                    }
                    order.setStatus(OrderStatus.CONFIRMED);
                    return orderRepository.save(order);
                })
                .as(transactionalOperator::transactional); // ← реактивная транзакция
    }
}
```

### 5.5. Контроллер

```java
@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    @GetMapping("/{id}")
    public Mono<ResponseEntity<OrderDto>> getOrder(@PathVariable Long id) {
        return orderService.findById(id)
                .map(order -> ResponseEntity.ok(OrderDto.from(order)))
                .onErrorResume(OrderNotFoundException.class,
                    e -> Mono.just(ResponseEntity.notFound().build()));
    }

    @GetMapping
    public Flux<OrderDto> getOrdersByStatus(@RequestParam OrderStatus status) {
        return orderService.findByStatus(status)
                .map(OrderDto::from);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<OrderDto> createOrder(@Valid @RequestBody Mono<CreateOrderRequest> request) {
        return request
                .flatMap(orderService::create)
                .map(OrderDto::from);
    }

    @PostMapping("/{id}/confirm")
    public Mono<OrderDto> confirmOrder(@PathVariable Long id) {
        return orderService.confirm(id)
                .map(OrderDto::from);
    }

    /**
     * Server-Sent Events — стриминг заказов.
     * Демонстрирует backpressure от клиента до БД.
     */
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<OrderDto> streamOrders(@RequestParam OrderStatus status) {
        return orderService.findByStatus(status)
                .map(OrderDto::from)
                .delayElements(Duration.ofMillis(100)); // имитация медленного клиента
    }
}
```

**DTO (record, Java 21)**

```java
public record OrderDto(
        Long id,
        String customerName,
        BigDecimal amount,
        OrderStatus status,
        LocalDateTime createdAt
) {
    public static OrderDto from(Order order) {
        return new OrderDto(
                order.getId(),
                order.getCustomerName(),
                order.getAmount(),
                order.getStatus(),
                order.getCreatedAt()
        );
    }
}

public record CreateOrderRequest(
        @NotBlank String customerName,
        @NotNull @Positive BigDecimal amount
) {}
```

### 5.6. Реактивные транзакции: глубокое погружение

Это одна из самых сложных тем в реактивной работе с БД. Разберём все варианты.

#### 5.6.1. Проблема: почему `@Transactional` работает иначе

В императивном Spring `@Transactional` использует `ThreadLocal` для хранения транзакционного контекста:

```java
// Императивный мир:
Thread-1: @Transactional → begin TX → save() → update() → commit TX
          ↑ ThreadLocal хранит Connection и TX status на протяжении всего вызова
```

В реактивном мире один pipeline может выполняться на **разных потоках**:

```java
// Реактивный мир:
EL-1: subscribe() → findById() → [отправлен SQL] → (поток свободен)
EL-3: [ответ от БД] → flatMap → save() → [отправлен SQL] → (поток свободен)
EL-1: [ответ от БД] → map → onComplete
```

`ThreadLocal` здесь **бесполезен** — контекст потеряется при переключении потока.

**Решение**: Spring использует **Reactor Context** — immutable map, который пробрасывается через реактивный pipeline снизу вверх (от подписчика к источнику).

```java
// Как Spring хранит транзакцию в Reactor Context (упрощённо):
Mono<Order> pipeline = orderRepository.findById(id)
    .flatMap(order -> orderRepository.save(order));

// .as(transactionalOperator::transactional) добавляет:
pipeline
    .contextWrite(ctx -> ctx.put(
        TransactionSynchronizationManager.class,
        new ReactiveTransactionSynchronization(connection, txDefinition)
    ));
```

#### 5.6.2. Способ 1: `@Transactional` (декларативный)

Spring Boot 3.x поддерживает `@Transactional` для реактивных методов, **если настроен `ReactiveTransactionManager`**:

```java
@Configuration
@EnableTransactionManagement
public class TransactionConfig {

    @Bean
    public ReactiveTransactionManager transactionManager(ConnectionFactory connectionFactory) {
        return new R2dbcTransactionManager(connectionFactory);
    }
}
```

> **💡 Примечание**: Spring Boot auto-configuration создаёт `R2dbcTransactionManager` автоматически при наличии `spring-boot-starter-data-r2dbc`. Явная конфигурация нужна только для кастомизации.

```java
@Service
@RequiredArgsConstructor
public class OrderServiceDeclarative {

    private final OrderRepository orderRepository;

    @Transactional
    public Mono<Order> confirm(Long id) {
        return orderRepository.findById(id)
                .switchIfEmpty(Mono.error(new OrderNotFoundException(id)))
                .flatMap(order -> {
                    if (order.getStatus() != OrderStatus.CREATED) {
                        return Mono.error(new IllegalStateException(
                            "Cannot confirm: " + order.getStatus()));
                    }
                    order.setStatus(OrderStatus.CONFIRMED);
                    return orderRepository.save(order);
                });
    }

    @Transactional(readOnly = true)
    public Flux<Order> findExpensive(BigDecimal minAmount) {
        return orderRepository.findExpensiveOrders(minAmount);
    }
}
```

**Как это работает под капотом**

```
1. AOP-прокси перехватывает вызов confirm().
2. ReactiveTransactionInterceptor:
   a. Получает Connection из пула (Mono<Connection>).
   b. Вызывает connection.beginTransaction().
   c. Помещает Connection в Reactor Context.
   d. Выполняет метод — все операции внутри используют ТУ ЖЕ Connection из Context.
   e. При onComplete → connection.commitTransaction().
   f. При onError → connection.rollbackTransaction().
   g. Возвращает Connection в пул.
```

> **Жизненный цикл реактивной транзакции**
>
> ```
> subscribe()
>     │
>     ▼
> ┌──[AOP Proxy]──────────────────────────────────────────────┐
> │  pool.create() ──▶ Mono<Connection>                       │
> │       │                                                    │
> │       ▼                                                    │
> │  connection.beginTransaction() ──▶ Mono<Void>             │
> │       │                                                    │
> │       ▼  contextWrite(ctx → ctx.put(TX_KEY, connection))  │
> │  ┌────────────────────────────────────────┐               │
> │  │  findById(id)     ← использует conn    │               │
> │  │       │           из Reactor Context    │               │
> │  │       ▼                                 │               │
> │  │  save(order)      ← та же conn         │               │
> │  └────────────────────────────────────────┘               │
> │       │                                                    │
> │       ├── onComplete → connection.commitTransaction()      │
> │       ├── onError    → connection.rollbackTransaction()    │
> │       └── finally    → connection.close() (возврат в пул) │
> └────────────────────────────────────────────────────────────┘
> ```

**Типичная ошибка: транзакция не работает**

```java
@Transactional
public Mono<Order> confirmBroken(Long id) {
    Mono<Order> result = orderRepository.findById(id)
            .flatMap(order -> {
                order.setStatus(OrderStatus.CONFIRMED);
                return orderRepository.save(order);
            });

    //   ОШИБКА: подписка происходит ВНЕ транзакционного контекста
    result.subscribe();

    return Mono.empty();
}
```

Транзакция привязана к **конкретной цепочке подписки**. Если вы создаёте побочную подписку через `.subscribe()` — она выполнится **без транзакции**.

#### 5.6.3. Способ 2: `TransactionalOperator` (программный)

Более явный и гибкий подход:

```java
@Service
@RequiredArgsConstructor
public class OrderServiceProgrammatic {

    private final OrderRepository orderRepository;
    private final TransactionalOperator txOperator;

    // Конфигурация TransactionalOperator:
    // @Bean
    // TransactionalOperator transactionalOperator(ReactiveTransactionManager txManager) {
    //     return TransactionalOperator.create(txManager);
    // }
    // Spring Boot создаёт автоматически.

    /**
     * Вариант 1: .as(txOperator::transactional)
     * Оборачивает весь Mono/Flux в транзакцию
     */
    public Mono<Order> confirm(Long id) {
        return orderRepository.findById(id)
                .switchIfEmpty(Mono.error(new OrderNotFoundException(id)))
                .flatMap(order -> {
                    order.setStatus(OrderStatus.CONFIRMED);
                    return orderRepository.save(order);
                })
                .as(txOperator::transactional);
    }

    /**
     * Вариант 2: txOperator.execute(callback)
     * Полный контроль над транзакцией, включая ручной rollback
     */
    public Mono<Order> createWithAudit(CreateOrderRequest request) {
        return txOperator.execute(status -> {
            var order = new Order(
                request.customerName(),
                request.amount(),
                OrderStatus.CREATED
            );
            return orderRepository.save(order)
                    .flatMap(saved -> {
                        if (saved.getAmount().compareTo(new BigDecimal("10000")) > 0) {
                            // Программный rollback для крупных заказов без аудита
                            status.setRollbackOnly();
                            return Mono.error(new AuditRequiredException(saved.getId()));
                        }
                        return Mono.just(saved);
                    });
        }).next(); // execute возвращает Flux — берём первый элемент
    }

    /**
     * Сложный сценарий: несколько операций в одной транзакции
     */
    public Mono<Order> transferAndConfirm(Long fromOrderId, Long toOrderId, BigDecimal amount) {
        return orderRepository.findById(fromOrderId)
                .zipWith(orderRepository.findById(toOrderId))
                .flatMap(tuple -> {
                    Order from = tuple.getT1();
                    Order to = tuple.getT2();

                    from.setAmount(from.getAmount().subtract(amount));
                    to.setAmount(to.getAmount().add(amount));
                    to.setStatus(OrderStatus.CONFIRMED);

                    return orderRepository.save(from)
                            .then(orderRepository.save(to));
                })
                .as(txOperator::transactional);
    }
}
```

**Когда использовать `@Transactional` и `TransactionalOperator`**

| Сценарий | Рекомендация |
|----------|-------------|
| Простая транзакция на один метод | `@Transactional` |
| Программный rollback по условию | `TransactionalOperator.execute()` |
| Транзакция на часть pipeline | `TransactionalOperator.transactional()` |
| Вложенные транзакции / savepoints | `TransactionalOperator` с `TransactionDefinition` |
| Тестирование | `TransactionalOperator` проще мокать |

#### 5.6.4. Настройка уровня изоляции и propagation

```java
@Bean
public TransactionalOperator readCommittedTxOperator(ReactiveTransactionManager txManager) {
    var definition = new DefaultTransactionDefinition();
    definition.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);
    definition.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRED);
    definition.setTimeout(5); // секунды
    definition.setReadOnly(false);
    return TransactionalOperator.create(txManager, definition);
}
```

## Выводы

Реактивный WebFlux даёт масштабирование только при end-to-end non-blocking: если слой данных остаётся на JDBC/JPA, ты либо блокируешь event loop, либо уводишь работу в boundedElastic/пулы и теряешь предсказуемость latency под нагрузкой.

JDBC/Hibernate в реактивном стеке конфликтуют с моделью Reactor: thread-bound-транзакции/-сессии, блокирующий I/O, слабая поддержка отмены и отсутствие backpressure на уровне драйвера — это архитектурный mismatch, а не «просто настройка».

Асинхронность в Java — это разные компромиссы: @Async/CompletableFuture и даже Virtual Threads чаще являются способом «дешевле блокировать», но не превращают доступ к БД в реактивный; R2DBC — именно про неблокирующий I/O и корректную интеграцию с реактивным пайплайном.

В R2DBC критичны правильные примитивы: reactive transactions через TransactionalOperator, корректное управление соединениями через r2dbc-pool (не HikariCP), дисциплина потоков (не блокировать, не делать .block()) и осознанная обработка ошибок/ретраев.

R2DBC — не универсальная замена JPA: его стоит выбирать для высококонкурентных I/O-нагруженных сервисов и реактивного стека; не стоит — для сложной ORM-графики, legacy миграций, CPU-bound-задач, где проще и надёжнее JDBC/JPA (в том числе с Virtual Threads).
