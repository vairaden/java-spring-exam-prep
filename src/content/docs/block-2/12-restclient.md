---
title: "12. RestClient"
description: "Составление HTTP-запросов, заголовки, авторизация, обработка ответов и ошибок"
---

> RestClient. Составление HTTP-запросов. Отправка хедеров. Базовая авторизация, отправка хедеров авторизации. Обработка ответов и исключения.

## Что такое RestClient

**`RestClient`** (Spring 6.1+) — современный **синхронный** HTTP-клиент с fluent API,
пришедший на смену `RestTemplate`. Реактивный аналог — `WebClient`. Создание:
```java
RestClient client = RestClient.builder()
    .baseUrl("https://api.example.com")
    .defaultHeader("User-Agent", "my-app")
    .build();
```

## Составление запросов

```java
// GET с path/query параметрами
Task task = client.get()
    .uri("/tasks/{id}?expand={e}", id, "attachments")
    .retrieve()
    .body(Task.class);

// POST с телом (сериализуется в JSON)
TaskDto created = client.post()
    .uri("/tasks")
    .contentType(MediaType.APPLICATION_JSON)
    .body(new CreateTaskDto("Buy milk"))
    .retrieve()
    .body(TaskDto.class);

// Список
List<Task> tasks = client.get().uri("/tasks")
    .retrieve()
    .body(new ParameterizedTypeReference<List<Task>>() {});
```

## Отправка заголовков

```java
client.get().uri("/tasks")
    .header("X-Request-Id", id)
    .accept(MediaType.APPLICATION_JSON)
    .retrieve().body(...);
```
Глобальные заголовки — через `defaultHeader(...)` в билдере.

## Авторизация

**Basic Auth:**
```java
client.get().uri("/secure")
    .headers(h -> h.setBasicAuth("user", "password"))
    .retrieve().body(...);
```
**Bearer (JWT/OAuth):**
```java
client.get().uri("/secure")
    .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
    // или .headers(h -> h.setBearerAuth(token))
    .retrieve().body(...);
```
Можно задать токен глобально через `defaultHeaders`/интерсептор (`ClientHttpRequestInterceptor`).

## Обработка ответов

- **`.retrieve()`** — короткий путь: сразу извлекает тело, на `4xx/5xx` бросает
  `RestClientResponseException` (`HttpClientErrorException`/`HttpServerErrorException`).
- **`.exchange()`** — полный доступ к статусу, заголовкам и телу (ручная обработка).
- **`ResponseEntity`** для доступа к статусу/заголовкам:
```java
ResponseEntity<Task> resp = client.get().uri("/tasks/{id}", id)
    .retrieve().toEntity(Task.class);
resp.getStatusCode(); resp.getHeaders();
```

## Обработка ошибок

```java
Task task = client.get().uri("/tasks/{id}", id)
    .retrieve()
    .onStatus(HttpStatusCode::is4xxClientError, (req, res) -> {
        if (res.getStatusCode() == HttpStatus.NOT_FOUND)
            throw new TaskNotFoundException(id);
        throw new ExternalApiException(res.getStatusText());
    })
    .onStatus(HttpStatusCode::is5xxServerError, (req, res) -> {
        throw new ExternalApiException("upstream error");
    })
    .body(Task.class);
```
`onStatus` позволяет маппить коды на доменные исключения. Без `onStatus` `retrieve()` сам
бросит исключение на `4xx/5xx`. Полезно комбинировать с Resilience4j (таймауты, retry,
circuit breaker — см. вопрос 13).

## 🔗 Смежные вопросы
- [Б1.16 — HTTP, REST, OpenAPI](/block-1/16-rest-openapi/)
- [Б2.13 — Resilience4j (защита вызовов)](/block-2/13-resilience4j/)
- [Б2.11 — Spring Security, JWT (Bearer-авторизация)](/block-2/11-security/)

## 📚 Материалы
- [Лонгрид 10 — HTTP-запросы и ответы. RestClient](/longreads/10-http-restclient/)
