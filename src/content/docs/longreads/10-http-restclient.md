---
title: "Лонгрид 10. HTTP-запросы и ответы. RestClient"
description: "Составление запросов, заголовки, обработка ошибок, OpenAPI"
---

## Вступление: отправка запросов
Когда ты начинаешь писать Spring-приложение, создаётся впечатление, что HTTP — это «ну там URL и JSON, остальное неважно». И правда: Spring делает многое за нас. Но как только ты выходишь за рамки «простого CRUD» и начинаешь интеграции (платёжки, доставки, email/SMS, внешние каталоги, микросервисы, SSO), выясняется, что 80% проблем — это:

- не тот заголовок (сервер возвращает HTML вместо JSON);
- забыт `Authorization`;
- неверно закодирован параметр query;
- не обработан 429, и тебя забанили;
- не учтён тайм-аут;
- неправильно обработан 204;
- проглочено тело ошибки, и в логах «ничего не понятно».

Задача лекции — превратить HTTP из «неважного» в понятный инструмент.

Мы будем рассматривать синхронный клиент:
- **RestClient** — простой и очень удобный, если ты пишешь обычный MVC backend.

---

## Состав HTTP-запросов и ответов

### 1.1. HTTP-запрос: из чего он состоит «по-настоящему»
В интернете очень любят показывать HTTP так:

> GET /users

У HTTP-запроса есть:

1) **Метод** (GET/POST/PUT/DELETE/PATCH…) — что мы хотим сделать.
2) **Request target** (путь + query string) — к чему применяем метод.
3) **Версия протокола** (HTTP/1.1, HTTP/2) — обычно абстрагируемся.
4) **Заголовки** — метаданные, правила, условия, авторизация, форматы, кеш.
5) **Тело** — данные (не всегда есть).

Пример в сыром виде (упрощённо):

```java
POST /v1/tasks?notify=true HTTP/1.1
Host: api.example.com
Content-Type: application/json
Accept: application/json
Authorization: Bearer eyJhbGciOi...
User-Agent: my-service/1.0

{"title":"Buy milk","description":"2 liters"}
```

#### Вопросы, которые обычно задают
**Вопрос**: «Почему Host — заголовок, а не часть URL?»  
**Ответ**: исторически в HTTP/1.1 это так устроено; Host обязателен. В HTTP/2 много иначе, но на уровне программирования ты всё равно задаёшь URL, и клиент сам выставит Host.

**Вопрос**: «Можно ли у GET делать body?»  
**Ответ**: формально спецификация не запрещает, но на практике многие прокси/серверы/кеши ведут себя непредсказуемо. Поэтому в нормальном API — нет.

---

### 1.2. HTTP-ответ: статус, заголовки и тело
Ответ устроен симметрично:

1) **Статус-код** — главный индикатор результата.
2) **Заголовки** — формат тела, длина, кеш, куки, корреляция.
3) **Тело** — payload (может быть пустым).

Пример:

```java
HTTP/1.1 201 Created
Content-Type: application/json
Location: /v1/tasks/42

{"id":42,"title":"Buy milk","completed":false}
```

Обрати внимание на заголовок `Location`. Он не обязателен, но хорошая практика: если ресурс создан, сервер может сказать, где он теперь живёт.

#### Узкий момент: 204 No Content
Очень частая «мина»: сервер возвращает **204**, то есть «успешно, но тела нет».  
Если твой клиент пытается прочитать body как JSON, ты получишь ошибку парсинга или `null`. Это нужно учитывать.

---

### 1.3. Метод — это не «просто слово», это смысл (семантика)
- **GET**: получить представление ресурса (не изменяет состояние).
- **POST**: создать/запустить действие (обычно неидемпотентен).
- **PUT**: заменить ресурс полностью (обычно идемпотентен).
- **PATCH**: частично изменить ресурс (часто идемпотентен, но не обязан).
- **DELETE**: удалить ресурс (обычно идемпотентен: второй раз удалять нечего).

Почему это важно?  
Потому что от этого зависит:
- допустимость повторов (ретраи),
- кеширование,
- поведение прокси,
- корректность API.

---

### 1.4. URL и query-параметры: почему «склейка строк» — это источник багов
Часто делают так:

```java
String url = "/v1/tasks?title=" + title;
```

И всё работает ровно до тех пор, пока `title` не содержит пробел, `&`, `?`, `#`, `+`, кириллицу и прочее. После этого ты получишь:
- неверный запрос,
- неожиданно «обрезанные» параметры,
- проблемы с кодировкой.

Правильный подход — использовать **URI builder**.

---

### 1.5. Заголовки: где «живут» важные смыслы
Если тело — это «данные», то заголовки — это «условия и правила».

Самые важные в нашей практике:

- `Content-Type`: что мы отправляем (JSON, multipart, текст…);
- `Accept`: что мы хотим получить;
- `Authorization`: кто мы;
- `User-Agent`: кто клиент (некоторые API требуют);
- `X-Request-Id`: уникальный идентификатор запроса для логов;
- `If-None-Match` / `ETag`: кеш и условные запросы;
- `Accept-Encoding`: сжатие (gzip/br).

Ключевая мысль: **большинство интеграционных багов лечатся заголовками**.

---

# Составление HTTP-запросов (RestClient)

Прежде чем писать код, определимся с типовой структурой в приложении:

- `SomeApiClient` (класс) — отвечает за вызов внешнего API;
- DTO для запросов/ответов;
- конфиг клиента (baseUrl, тайм-ауты, дефолтные headers).

Это лучше, чем вызывать HTTP прямо из контроллера/сервиса бизнес-логики.

## 2.1. Настройка RestClient: «простая» синхронная модель
RestClient появился как современная замена RestTemplate. Он читабельный, лаконичный и хорошо подходит для классических приложений.

### Конфигурация
```java
@Configuration
public class RestClientConfig {

    @Bean
    RestClient restClient(RestClient.Builder builder) {
        return builder
                .baseUrl("https://api.example.com")
                .defaultHeader("User-Agent", "demo-app/1.0")
                .build();
    }
}
```

**Что здесь важно:**
- `baseUrl` избавляет от повторения домена;
- `defaultHeader` полезен для общих заголовков (User-Agent, Accept).

---

## 2.3. GET с query-параметрами: правильная сборка URI

Допустим, ты хочешь получить список задач:
`GET /v1/tasks?completed=false&limit=20`.

### DTO
```java
public record TaskDto(Long id, String title, boolean completed) {}
```

### RestClient
```java
@Service
public class TasksRestClient {

    private final RestClient restClient;

    public TasksRestClient(RestClient restClient) {
        this.restClient = restClient;
    }

    public List<TaskDto> getTasks(boolean completed, int limit) {
        return restClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/v1/tasks")
                        .queryParam("completed", completed)
                        .queryParam("limit", limit)
                        .build())
                .accept(MediaType.APPLICATION_JSON)
                .retrieve()
                .body(new ParameterizedTypeReference<List<TaskDto>>() {});
    }
}
```

Здесь важны три момента:
1) `uriBuilder` делает encoding как надо.
2) `.accept(JSON)` говорит серверу «отдай JSON».
3) Для списка используем `ParameterizedTypeReference`.

---

## 2.4. POST с JSON: как не забыть Content-Type
Если ты отправляешь JSON, почти всегда нужно выставить `Content-Type: application/json`. Иногда сервер догадается, но рассчитывать на это не стоит.

### DTO
```java
public record TaskCreateRequest(String title, String description) {}
public record TaskResponse(Long id, String title, String description) {}
```

### RestClient POST
```java
public TaskResponse create(TaskCreateRequest req) {
    return restClient.post()
            .uri("/v1/tasks")
            .contentType(MediaType.APPLICATION_JSON)
            .accept(MediaType.APPLICATION_JSON)
            .body(req)
            .retrieve()
            .body(TaskResponse.class);
}
```

---

## 2.5. PUT/PATCH: тонкость «что именно обновляется»
На реальных API ты увидишь:
- что PUT требует полного объекта (иначе «затираешь поля null'ами»),
- PATCH позволяет передать только изменённое.

### Patch DTO
```java
public record TaskPatchRequest(Boolean completed) {}
```

RestClient:
```java
public TaskResponse patch(long id, TaskPatchRequest req) {
    return restClient.patch()
            .uri("/v1/tasks/{id}", id)
            .contentType(MediaType.APPLICATION_JSON)
            .body(req)
            .retrieve()
            .body(TaskResponse.class);
}
```

---

# Отправка хедеров. Базовая авторизация и Authorization header

70% интеграций упираются в то, что ты не так отправляешь заголовок авторизации.

## 3.1. Общий принцип: заголовки можно ставить глобально и локально
- Глобально: в конфиге клиента (`defaultHeader`).
- Локально: в конкретном запросе (`header(...)`, `headers(h -> ...)`).

Нормальная практика:
- глобально ставить `User-Agent`, `Accept`;
- авторизацию ставить либо глобально через фильтр/интерцептор (если одна на все запросы), либо локально (если разные токены/пользователи).

---

## 3.2. Отправка произвольных заголовков

### RestClient
```java
public TaskResponse getTask(long id, String requestId) {
    return restClient.get()
            .uri("/v1/tasks/{id}", id)
            .header("X-Request-Id", requestId)
            .accept(MediaType.APPLICATION_JSON)
            .retrieve()
            .body(TaskResponse.class);
}
```

---

## 3.3. Basic Authentication: что это такое и как работает
**Basic auth** — это заголовок вида:

`Authorization: Basic base64(username:password)`.

Важно понимать: Base64 — **не шифрование**, это просто кодировка. Без HTTPS Basic auth — это «пароль в открытом виде».

### RestClient Basic auth
Есть удобный способ: выставить header вручную.

```java
import java.nio.charset.StandardCharsets;
import java.util.Base64;

private static String basicAuth(String user, String pass) {
    String token = user + ":" + pass;
    return "Basic " + Base64.getEncoder().encodeToString(token.getBytes(StandardCharsets.UTF_8));
}

public String callWithBasic() {
    return restClient.get()
            .uri("/v1/secure")
            .header(HttpHeaders.AUTHORIZATION, basicAuth("alice", "secret"))
            .retrieve()
            .body(String.class);
}
```

## 3.4. Bearer Token (JWT/OAuth2): самый частый случай
Это заголовок:

`Authorization: Bearer <token>`.

### RestClient
```java
public TaskResponse getTaskAuthorized(long id, String accessToken) {
    return restClient.get()
            .uri("/v1/tasks/{id}", id)
            .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
            .retrieve()
            .body(TaskResponse.class);
}
```
### Узкий момент: «Bearer» + пробел
Забытый пробел — одна из самых глупых, но очень частых ошибок.

## 3.5. Автоматическая подстановка Authorization: «не хочу писать заголовок в каждом методе»

Это очень правильное желание. В хороших проектах `header("Authorization", ...)` почти никогда не множится по коду. Причины:
- токен может обновляться;
- авторизация может быть разной для разных «клиентов»;
- нужен единый контроль логирования/маскирования;
- иногда нужно добавить correlation id, идемпотентность, feature flags и так далее.

---

### 3.5.2. RestClient: «глобальные» заголовки и интерцепторы
RestClient — синхронный API. В Spring 6+ он построен вокруг HTTP-инфраструктуры Spring. Самый надёжный и повторяемый подход: **задать default headers** на builder и (или) использовать механизм перехвата через underlying request factory (в зависимости от используемого клиента).

Есть 2 два уровня.

#### Уровень 1: defaultHeader (когда токен статический)
Если токен не меняется:
```java
@Configuration
public class RestClientConfig {

    @Bean
    RestClient restClient(RestClient.Builder builder, TokenProvider tokenProvider) {
        return builder
                .baseUrl("https://api.example.com")
                .defaultHeader("User-Agent", "demo-app/1.0")
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + tokenProvider.getAccessToken())
                .build();
    }
}
```

Это работает, но в реальности токен часто нужно обновлять.

#### Уровень 2: когда токен обновляется
Тут обычно делают «обёртку» над RestClient: не столько интерцептор, сколько единая точка формирования запросов.

Например:
```java
@Component
public class AuthorizedRestClient {

    private final RestClient restClient;
    private final TokenProvider tokenProvider;

    public AuthorizedRestClient(RestClient restClient, TokenProvider tokenProvider) {
        this.restClient = restClient;
        this.tokenProvider = tokenProvider;
    }

    public RestClient.RequestHeadersSpec<?> get(String uriTemplate, Object... uriVars) {
        return restClient.get()
                .uri(uriTemplate, uriVars)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenProvider.getAccessToken());
    }

    public RestClient.RequestBodySpec post(String uriTemplate, Object... uriVars) {
        return restClient.post()
                .uri(uriTemplate, uriVars)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenProvider.getAccessToken());
    }
}
```

И дальше используешь:
```java
public TaskResponse getTask(long id) {
    return authorizedRestClient.get("/v1/tasks/{id}", id)
            .retrieve()
            .body(TaskResponse.class);
}
```

**Это не так красиво, но очень практично**: ты держишь всё в одном месте.

---

### 3.6. Корреляционные заголовки: X-Request-Id/traceparent
В реальных системах почти всегда нужен заголовок для трассировки.

Паттерн:
- входящий запрос получает `X-Request-Id` (если не пришёл — генерим);
- при вызове внешних сервисов этот id пробрасывается;
- в логах можно связать цепочку.

В production обычно берут request-id из MDC / Trace context.

---

# Обработка ответов и исключений

Эта часть важнее, чем кажется. Успешные ответы все умеют обрабатывать, а вот *что делать, когда ответ неуспешный*, — это сложнее.

## 4.1. Что может пойти не так (классификация проблем)
Когда ты зовёшь внешний HTTP-сервис, неудачи бывают четырёх типов:

1) **Сеть/инфраструктура**: DNS, соединение, TLS, timeouts.
2) **HTTP-ошибки**: 4xx/5xx с телом ошибки или без.
3) **Содержимое**: пришёл не тот формат, JSON не парсится, неожиданные поля.
4) **Логика**: бизнес-ошибка, но статус 200 (встречается в «плохих» API).

Хороший клиент различает эти категории — по ним разные действия (retry, fallback, открыть circuit breaker, поднять алерт, показать пользователю «повторите позже» и так далее).

## 4.2. RestClient: retrieve () и обработка статусов

RestClient типично используется так:
```java
TaskResponse resp = restClient.get()
    .uri("/v1/tasks/{id}", id)
    .retrieve()
    .body(TaskResponse.class);
```

Но вопрос: что будет, если сервер вернул 404?

Чаще всего `retrieve()` выбросит исключение (типа `HttpClientErrorException`/`RestClientResponseException` в зависимости от реализации). И тебе нужно:
- либо перехватить и превратить в своё исключение,
- либо использовать `onStatus` и разобрать тело ошибки.

### 4.2.1. Пример: маппинг 404 → Optional. Empty
```java
public Optional<TaskResponse> findTask(long id) {
    try {
        TaskResponse resp = restClient.get()
                .uri("/v1/tasks/{id}", id)
                .accept(MediaType.APPLICATION_JSON)
                .retrieve()
                .body(TaskResponse.class);

        return Optional.ofNullable(resp);

    } catch (NotFound e) {
        return Optional.empty();
    }
}
```

**Плюс**: просто.  
**Минус**: ты теряешь тело ошибки, если оно было полезным.

## 4.2.2. Пример: кастомная ошибка с телом (Problem Details)
Многие API возвращают problem details:
```json
{
  "type": "https://example.com/errors/not-found",
  "title": "Not Found",
  "status": 404,
  "detail": "Task 123 not found"
}
```

Сделаем DTO:
```java
public record ProblemDetails(String type, String title, int status, String detail) {}
```

И клиент:
```java
public TaskResponse getTaskOrThrow(long id) {
    try {
        return restClient.get()
                .uri("/v1/tasks/{id}", id)
                .accept(MediaType.APPLICATION_JSON)
                .retrieve()
                .body(TaskResponse.class);
    } catch (HttpClientErrorException e) {
        // Пытаемся распарсить тело
        ProblemDetails pd = null;
        try {
            pd = new ObjectMapper()
                    .readValue(e.getResponseBodyAsByteArray(), ProblemDetails.class);
        } catch (Exception ignore) {}
        
        if (e.getStatusCode().value() == 404) {
            throw new TaskNotFoundException(pd != null ? pd.detail() : "Task not found: " + id);
        }
        throw new ExternalApiException("Client error: " + e.getStatusCode(), e);
    } catch (HttpServerErrorException e) {
        throw new ExternalApiException("Server error: " + e.getStatusCode(), e);
    }
}
```

Да, это многословно. Но это и есть цена хорошей интеграции: ты хочешь понимать причины.
### 4.4. Ошибка десериализации (JSON «не такой»)
Ошибка класса «сервис сломан» или «контракт изменился»:

- сервер вернул HTML (например, прокси выдал страницу ошибки);
- сервер вернул JSON другого формата;
- сервер вернул пустое тело, а ты ждёшь объект.

**Практическое правило:**
- на неожиданные ответы делай лог тела (с ограничением размера и без секретов);
- используй `Accept: application/json`;
- проверяй `Content-Type` ответа, если интеграция критичная.

### 4.5. Тайм-ауты: то, о чём забывают до первого инцидента
Если ты не задаёшь тайм-ауты, сервис может «повиснуть» на ожидании внешнего API, что приведёт к исчерпанию потоков и лавинообразному отказу.

- В синхронном мире (RestClient) — ты займёшь поток.
- В реактивном (WebClient) — ты не займёшь поток так же, но зависнешь по ресурсам/соединениям и создашь очередь.

```java
package com.example.demo.http;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;
import java.time.Duration;

@Configuration
public class RestClientConfig {

    @Bean
    public RestClient restClient(RestClient.Builder builder) {
        // Тайм-аут на установление соединения (TCP/TLS)
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(2))
                .build();

        // RequestFactory для RestClient (в Spring 6)
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);

        // Тайм-аут ожидания ответа (чтение) — сколько ждём, пока сервер ответит
        requestFactory.setReadTimeout(Duration.ofSeconds(3));

        return builder
                .requestFactory(requestFactory)
                .baseUrl("https://api.example.com")
                .build();
    }
}

```
Настройка тайм-аутов зависит от underlying клиента (JDK HttpClient, Reactor Netty). В рамках лекции важно: **тайм-ауты должны быть**.
### 4.6. Повторы (retry) и идемпотентность: можно ли повторить запрос?
Обычно хочется сказать: «Если упало — повтори».

Но здесь скрыт фундаментальный момент: **не каждый запрос безопасно повторять**.

- GET — обычно можно повторить.
- PUT/DELETE — обычно можно (идемпотентны).
- POST — часто нельзя (создаст дубль), но можно, если есть `Idempotency-Key` или сервер гарантирует идемпотентность.
### 4.7. 429 Too Many Requests: как вести себя культурно
Если получен 429, обычно API сообщает «подожди» через `Retry-After`.
Узкий момент: многие клиенты это игнорируют и начинают DDOSить API ещё сильнее.
В production это связывают с rate limiter, backoff и так далее.
### 4.8. Договоримся о структуре
Хорошая структура:

- `client/TasksClient` — HTTP-вызовы;
- `dto` — request/response;
- `exception` — свои исключения;
- `config` — конфиги RestClient;
- `service` — бизнес-логика, использует client.

# Пример «боевого» клиента на RestClient
```java
@Service
public class TasksClient {

    private final RestClient restClient;

    public TasksClient(RestClient restClient) {
        this.restClient = restClient;
    }

    public TaskResponse getTask(long id) {
        try {
            return restClient.get()
                    .uri("/v1/tasks/{id}", id)
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(TaskResponse.class);
        } catch (HttpClientErrorException.NotFound e) {
            throw new TaskNotFoundException("Task not found id=" + id);
        } catch (RestClientResponseException e) {
            // Здесь можно логировать status + body (но без секретов)
            throw new ExternalApiException("HTTP " + e.getStatusCode() + " body=" + safeBody(e), e);
        }
    }

    private String safeBody(RestClientResponseException e) {
        byte[] b = e.getResponseBodyAsByteArray();
        if (b == null || b.length == 0) return "";
        String s = new String(b, StandardCharsets.UTF_8);
        return s;
    }
}
```

---

# Частые вопросы и «тонкие» места

## 6.1. Почему приходит 415 Unsupported Media Type?
Почти всегда причина в следующем:
- забыли `Content-Type: application/json` при POST/PUT/PATCH
- или отправили multipart неправильно.
## 6.1. (Продолжение.) Почему приходит 415 Unsupported Media Type?
…Или отправили JSON, но сервер ожидал `application/x-www-form-urlencoded`, или наоборот.

**Диагностика**
1) Посмотри, какой `Content-Type` ты реально отправляешь.
2) Посмотри, что сервер ожидает (документация, OpenAPI).
3) Убедись, что тело соответствует заявленному типу.

**Практика**
- Для JSON всегда явно ставь `.contentType(MediaType.APPLICATION_JSON)`.
- Для форм — `application/x-www-form-urlencoded`.
- Для файлов — `multipart/form-data`.

---

## 6.2. Почему приходит 406 Not Acceptable?
Это обратная проблема: сервер не может отдать формат, который ты просишь в `Accept`.

Например, ты ставишь:
`Accept: application/xml`, а сервер умеет только JSON.

**Лечение**: ставь `Accept: application/json` или не задавай Accept вовсе (но лучше задавать явно, чтобы не получить HTML по умолчанию).

RestClient:
```java
.retrieve()
```
По умолчанию часто достаточно, но, когда ты интегрируешься со «странным» сервисом, лучше `.accept(MediaType.APPLICATION_JSON)`.

---

## 6.3. Почему получаю 401, хотя токен вроде правильный?
Проверяй по чеклисту:

1) Заголовок **именно** `Authorization`?
2) Значение начинается с `Bearer ` (с пробелом)?
3) Токен не просрочен?
4) Токен предназначен этому сервису (audience)?
5) Сервер ожидает другой тип (например, `Token` вместо `Bearer`)?
6) Не попадаешь ли ты на другой домен/окружение (staging vs prod) с другим ключом подписи?

**Практика**: логируй первые/последние 6 символов токена, но не весь токен.
```java
private String maskToken(String token) {
    if (token == null) return "null";
    if (token.length() <= 12) return "****";
    return token.substring(0, 6) + "..." + token.substring(token.length() - 6);
}
```

---

## 6.5. Почему я не вижу тело ошибки?
Причины:
- ты ловишь исключение, но не читаешь body (`getResponseBodyAsString()`/`getResponseBodyAsByteArray()`);
- сервер вернул тело, но оно не было прочитано (stream consumed).

Это привычный паттерн: «на ошибке читаем body и поднимаем своё исключение».

---

## 6.6. Как правильно обрабатывать 204 No Content?
Если ты ожидаешь `Void`, это проще.

RestClient:
```java
restClient.delete()
    .uri("/v1/tasks/{id}", id)
    .retrieve()
    .toBodilessEntity(); // не пытаемся парсить тело
```

**Если ты попытаешься `retrieve()` на класс с 204**, ты получишь:
- пустой объект, `null`, или исключение — зависит от конкретной ситуации. Лучше явно кодировать «нет тела».

---
## 6.7. Как работать с Location при 201 Created?
Классическая REST-конвенция: после POST сервер возвращает `201` и `Location: /resource/{id}`.

RestClient (как правило проще — тело сразу):
```java
ResponseEntity<TaskResponse> entity = restClient.post()
    .uri("/v1/tasks")
    .contentType(MediaType.APPLICATION_JSON)
    .body(req)
    .retrieve()
    .toEntity(TaskResponse.class);

URI location = entity.getHeaders().getLocation();
TaskResponse body = entity.getBody();
```

---

### 6.8. Как скачать файл (binary)?
Тело ответа может быть не JSON, а bytes.

RestClient:
```java

byte[] bytes = restClient.get()
    .uri("/v1/files/{id}", id)
    .accept(MediaType.APPLICATION_OCTET_STREAM)
    .retrieve()
    .body(byte[].class);
```

Здесь начинается тема стриминга и backpressure — уже отдельная лекция.

---

## Отладка и «наблюдаемость»: что логировать и чего не логировать

## 7.1. Логирование запросов/ответов — осторожно
Главная ловушка: желание логировать всё тело каждого запроса. В проде это:
- риски утечки персональных данных и токенов,
- большие объёмы логов,
- падение производительности.

**Рекомендация:**
- логируй метод, путь, статус, время;
- тело логируй только:
    - на dev/stage,
    - по feature-flag,
    - с лимитом длины и маскированием.

В реальном проекте — SLF4J и MDC traceId.

---

## Сравнение на одном примере: создать задачу, потом получить

Представим мини-сценарий:

1) POST `/v1/tasks` → получаем `id`.
2) GET `/v1/tasks/{id}` → получаем объект.
3) Если POST вернул 409 → говорим «уже существует».
4) Если GET вернул 404 → говорим «не найдено».

## 8.1. Вариант RestClient
```java
@Service
public class TasksScenarioRestClient {

    private final RestClient restClient;

    public TasksScenarioRestClient(RestClient restClient) {
        this.restClient = restClient;
    }

    public TaskResponse createAndFetch(TaskCreateRequest req) {
        TaskResponse created;
        try {
            created = restClient.post()
                    .uri("/v1/tasks")
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(req)
                    .retrieve()
                    .body(TaskResponse.class);
        } catch (HttpClientErrorException.Conflict e) {
            throw new ExternalApiException("Task already exists", e);
        }

        try {
            return restClient.get()
                    .uri("/v1/tasks/{id}", created.id())
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(TaskResponse.class);
        } catch (HttpClientErrorException.NotFound e) {
            throw new ExternalApiException("Created task not found immediately (eventual consistency?)", e);
        }
    }
}
```

Заметь, какой здесь «жизненный» комментарий: иногда сразу после создания ресурс может быть ещё не доступен (eventual consistency), и это важно учитывать.

---

# Заключение: как использовать HTTP-клиент правильно

Когда ты пишешь HTTP-клиент, ты, по сути, проектируешь «внутренний SDK» для внешнего API. И хороший SDK:

- всегда корректно формирует URL и query (не вручную);
- явно задаёт Content-Type и Accept;
- всегда добавляет нужные заголовки (Authorization, request-id);
- имеет понятную обработку ошибок: 4xx vs 5xx vs network;
- не теряет body ошибки (но и не логирует секреты);
- имеет тайм-ауты и, где уместно, повторы;
- даёт бизнес-коду простой интерфейс: `client.getTask(id)` вместо «построить запрос, распарсить».

---
# Rate limiter и Circuit breaker

Если ты думаешь, что твой микросервис — это стабильная крепость, то это не так. В распределённых системах всё, что может сломаться, сломается. Вопрос не в том, упадёт ли внешний API, а в том, насколько элегантно твоё приложение упадёт вместе с ним.  
Попытки обрабатывать ошибки через try-catch — это «программирование на надежде», в то же время паттерны Circuit Breaker и Rate Limiter спасают системы от каскадных обрушений.

## Философия отказа: почему «просто ждать» — это смерть
Главная проблема: не учитывается время ожидания (latency). Если внешний сервис тормозит, потоки (Threads) блокируются. Запросы копятся, память забивается, и в итоге падает сервис, хотя виноват другой. Это называется cascading failure (каскадный сбой).
## Circuit Breaker (разрыв контура): математика выживания
Паттерн Circuit Breaker — это конечный автомат, который не даёт биться в закрытую дверь. 

**Состояния**
* CLOSED — всё хорошо. Запросы проходят. Мы считаем статистику (процент ошибок).
* OPEN — порог ошибок (например, 50%) превышен. Запросы сразу отсекаются с ошибкой CallNotPermittedException. Мы даём внешнему сервису время «остыть».
* HALF_OPEN — спустя время (wait duration) мы пропускаем несколько пробных запросов. Если они успешны — возвращаемся в CLOSED. Если нет — снова OPEN.

Нельзя ставить failureRateThreshold наугад. Если ты поставишь 10% на нестабильном канале, предохранитель будет «хлопать» постоянно. Если 90% — он бесполезен.

В Resilience4j это рассчитывается на sliding window (скользящем окне). Либо по количеству запросов (Count-based), либо по времени (Time-based).

## Rate Limiter (ограничитель частоты): защита от «дурака» и DDoS
Если Circuit Breaker защищает от внешних сбоев, то Rate Limiter защищает сервис (или сторонний API) от перегрузки объёмом запросов.
* Зачем: чтобы не получить бан от провайдера (например, Telegram API или платёжный шлюз) и чтобы не дать одному пользователю «съесть» все ресурсы системы.
* Механика: Resilience4j использует алгоритм Token Bucket или Fixed Window.  
  Пример конфигурации:
```xml
resilience4j.ratelimiter:  
	instances:  
		backendService:  
			limitForPeriod: 10  
			limitRefreshPeriod: 1s  
			timeoutDuration: 0      # Ждать ли очереди или падать сразу?  
```

Не путай Rate Limiter и Bulkhead.
* Rate Limiter ограничивает частоту (запросы в секунду).
* Bulkhead ограничивает количество параллельных выполнений (потоков).  
  Если у тебя медленный метод, Rate Limiter на 100 запросов не спасёт — ты всё равно забьёшь пул потоков. Нужны оба.

## Resilience4j в Spring Boot: практика
Вместо того чтобы писать код руками, мы используем аннотации. Это удобно, но опасно, если не понимать приоритеты.
```java
@Service  
public class ExternalApiService {  
  
	@CircuitBreaker(name = "backendA", fallbackMethod = "fallback")  
	@RateLimiter(name = "backendA")  
	public String callExternalService() {  
		return restTemplate.getForObject("[https://unstable-api.com](https://unstable-api.com/)", String.class);  
	}  
	  
	public String fallback(Throwable t) {  
		return "Данные временно недоступны (Cache)";  
	}  
}  
```

В Resilience4j есть строгий порядок выполнения:
* Bulkhead,
* TimeLimiter,
* RateLimiter,
* CircuitBreaker,
* Retry.  

Если ты перепутаешь настройки в application.yml, Retry может начать стучаться в сервис, который Circuit Breaker уже пытается закрыть. Это «выстрел себе в ногу».

**Возможные риски**
* Отсутствие мониторинга: если внедрили Resilience4j, но не вывели метрики в Prometheus/Grafana, не видно проблем и состояния программы. Ты не узнаешь, что Circuit Breaker открыт, пока не начнут звонить клиенты. Следи за resilience4j_circuitbreaker_state.
* Плохие Fallback-методы: если твой fallback просто пишет в лог — этого недостаточно. Хороший fallback возвращает данные из кеша, дефолтные значения или ставит задачу в очередь.
* Default-настройки: стандартный waitDurationInOpenState — 60 секунд. Для высоконагруженного API это вечность. Настраивай тайминги под свой SLA.

**План действий**
* Действие: внедри resilience4j-micrometer, чтобы видеть реальное состояние предохранителей в Grafana.
* Мысль: проведи тест Chaos Engineering. Искусственно «урони» внешний сервис в тестовой среде и посмотри, как ведёт себя ваше приложение. Оно должно продолжать работать (пусть и с ограниченным функционалом).
* Мысль: перестань верить в 100% uptime сторонних сервисов. Проектируй систему так, как будто всё вокруг уже сломано.

Ниже — реализация Resilience4j в связке со Spring Boot 3.x.
1. **Конфигурация в application.yml (мозг системы)** 

Самая частая ошибка — оставить настройки по умолчанию. Для высоконагруженной системы это смерть.
```yaml
resilience4j:  
	circuitbreaker:  
		instances:  
			externalInventoryService:  
				registerHealthIndicator: true  
```

- Окно, в котором считаем ошибки (последние 10 запросов):  
  slidingWindowSize: 10.
-  Если 50% и более запросов упали — открываем цепь:  
   failureRateThreshold: 50.
-  Минимальное количество запросов, прежде чем начнем считать % (защита от прогрева):
   minimumNumberOfCalls: 5.
-  Сколько ждать в состоянии OPEN перед переходом в HALF_OPEN:  
   waitDurationInOpenState: 10s.
- Разрешаем 3 пробных запроса в HALF_OPEN:  
  permittedNumberOfCallsInHalfOpenState: 3.
-  Автоматический переход из OPEN в HALF_OPEN по истечении времени:  
   automaticTransitionFromOpenToHalfOpenEnabled: true.
-  Лимит: 5 запросов:  
   limitForPeriod: 5.
- Период: каждые 10 секунд:  
  limitRefreshPeriod: 10s.
-  Время ожидания потока, если лимит исчерпан (0 = упасть сразу):  
   timeoutDuration: 0s.

2. **Реализация сервиса с Fallback**  

Код должен быть декларативным. Обрати внимание на сигнатуру метода fallback.
```java
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;  
import io.github.resilience4j.ratelimiter.annotation.RateLimiter;  
import org.slf4j.Logger;  
import org.slf4j.LoggerFactory;  
import org.springframework.stereotype.Service;  
  
@Service  
public class InventoryService {  
	private static final Logger log = LoggerFactory.getLogger(InventoryService.class);  
  
	// Порядок аннотаций важен! Сначала проверяем лимиты, потом — состояние цепи 
	@RateLimiter(name = "externalInventoryService")  
	@CircuitBreaker(name = "externalInventoryService", fallbackMethod = "getInventoryFallback")  
	public String getStockLevel(String productId) {  
		log.info("Запрос данных со склада для товара: {}", productId);  
		// Эмуляция вызова внешнего API (например, через RestTemplate или WebClient)  
	return callRemoteApi(productId);  
}  
```

Fallback-метод обязан:
* иметь ту же сигнатуру (аргументы), что и основной метод;
* принимать Throwable последним аргументом.

```java
// Fallback-метод без параметра Throwable
private String getInventoryFallback(String productId) {
    log.warn("Fallback для товара {}: возвращаем значение по умолчанию", productId);
    return "0";  // допустим, на складе 0 единиц
}

// Альтернативный вариант с получением исключения
private String getInventoryFallback(String productId, Throwable t) {
    log.error("Ошибка при запросе товара {}: {}", productId, t.getMessage(), t);
    return "-1"; // сигнализируем об ошибке
} 
	  
private String callRemoteApi(String id) {  
	// Здесь должен быть реальный сетевой вызов  
	throw new RuntimeException("Remote Service Down");  
}  
 
 
``` 
3. **Продвинутый уровень: TimeLimiter и Retry**

Если сервис не отвечает за 2 секунды, мы хотим прервать поток и попробовать ещё раз 3 раза.  

**Конфигурация**
```yaml
resilience4j:
  circuitbreaker:
    instances:
      externalInventoryService:          # имя, совпадающее с name в аннотации
        registerHealthIndicator: true
        slidingWindowSize: 10
        minimumNumberOfCalls: 5
        permittedNumberOfCallsInHalfOpenState: 3
        automaticTransitionFromOpenToHalfOpenEnabled: true
        waitDurationInOpenState: 10s
        failureRateThreshold: 50
        eventConsumerBufferSize: 10
        recordExceptions:
          - java.io.IOException
          - org.springframework.web.client.HttpServerErrorException
  ratelimiter:
    instances:
      externalInventoryService:          # тоже имя для RateLimiter
        limitForPeriod: 10               # максимум запросов за период
        limitRefreshPeriod: 1s
        timeoutDuration: 500ms
```

**Ошибки**
* Не разделять исключения. Если ты ставишь Retry на 404 Not Found, ты делаешь неправильно. Сервис честно ответил, что данных нет, а ты продолжаешь его «пытать». Retry должен срабатывать только на временные ошибки (503, Timeout, 504).
* Забитый пул потоков. Если ты используешь CircuitBreaker без TimeLimiter и внешний сервис «завис» (не падает, а просто молчит), поток будет висеть до тайм-аута TCP (обычно это десятки секунд). Circuit Breaker не сработает, пока запрос не завершится ошибкой. Всегда ставь TimeLimiter.
* Игнорирование метрик. Без зависимости micrometer-registry-prometheus твои аннотации — это неработающий код. Нужно видеть на графике, как failure_rate ползёт вверх до того, как цепь разомкнётся.

**План действий**
* Действие: добавь зависимость io.github.resilience4j: resilience4j-spring-boot3.
* Действие: настрой HealthIndicator, чтобы Spring Boot Actuator показывал состояние цепей по адресу /actuator/health.
* Мысль: перестань проектировать «идеальные» сценарии. Напиши тесты, где твой callRemoteApi выкидывает RuntimeException 10 раз подряд, и убедись, что CircuitBreaker реально переходит в OPEN.

---
