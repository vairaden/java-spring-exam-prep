---
title: "16. HTTP, REST, OpenAPI"
description: "Основы HTTP/REST, OpenAPI и генерация контроллеров/клиентов"
---

> HTTP. REST. OpenAPI + Spring. Генерация контроллеров и клиентов по спецификации.

## HTTP

Протокол «запрос-ответ» поверх TCP, **stateless**. Запрос: метод + URL + заголовки + тело.
Ответ: статус-код + заголовки + тело.

- **Методы**: `GET` (чтение, идемпотентен), `POST` (создание), `PUT` (полная замена,
  идемпотентен), `PATCH` (частичное обновление), `DELETE` (удаление, идемпотентен).
- **Статусы**: `2xx` успех (`200 OK`, `201 Created`, `204 No Content`), `3xx`
  перенаправление, `4xx` ошибка клиента (`400`, `401`, `403`, `404`, `409`), `5xx` ошибка
  сервера (`500`, `503`).
- **Идемпотентность**: повтор запроса не меняет результат (GET/PUT/DELETE — да, POST — нет).

## REST

**REST** (Representational State Transfer) — архитектурный стиль. Принципы/ограничения:
- **Ресурсы** идентифицируются URI (`/api/tasks/42`); существительные, не глаголы.
- **Единообразный интерфейс** — операции выражаются HTTP-методами над ресурсом.
- **Stateless** — сервер не хранит состояние клиента между запросами.
- **Client–Server**, **кешируемость**, **многоуровневость**.
- **HATEOAS** (высший уровень зрелости) — ответ содержит ссылки на доступные действия.

## OpenAPI

**OpenAPI** — стандарт описания REST API (раньше Swagger) в YAML/JSON: эндпоинты, схемы
запросов/ответов, коды, авторизация. Даёт машиночитаемый контракт.

В Spring Boot — **springdoc-openapi**: генерирует спецификацию из кода и поднимает
Swagger UI:
```gradle
implementation 'org.springdoc:springdoc-openapi-starter-webmvc-ui:2.8.8'
```
- спецификация: `/v3/api-docs`
- интерактивный UI: `/swagger-ui.html`

Документировать можно аннотациями: `@Operation`, `@ApiResponse`, `@Schema`, `@Tag`.

## Два подхода: code-first и contract-first

- **Code-first** — пишем код, спецификация генерируется из него (springdoc).
- **Contract-first** — сначала пишут OpenAPI-спеку, затем по ней **генерируют код**.

## Генерация контроллеров и клиентов по спецификации

`openapi-generator` (плагин Gradle/Maven) по `.yaml`-спецификации генерирует:
- **серверные интерфейсы контроллеров** (`api` + DTO-модели) — реализуешь только бизнес-логику;
- **клиенты** (на Java — RestTemplate/WebClient/RestClient, либо для других языков).

```gradle
openApiGenerate {
    generatorName = "spring"
    inputSpec = "$rootDir/src/main/resources/openapi.yaml"
    outputDir = "$buildDir/generated"
    configOptions = [interfaceOnly: "true", useSpringBoot3: "true"]
}
```
Плюс contract-first: единый источник правды, синхронные клиент и сервер, контракт
согласован до написания кода.

## 🔗 Смежные вопросы
- [Б1.13 — Контроллеры, DTO, валидация](/block-1/13-controllers-dto/)
- [Б2.12 — RestClient (клиенты)](/block-2/12-restclient/)

## 📚 Материалы
- [Лонгрид 10 — HTTP-запросы и ответы. RestClient](/longreads/10-http-restclient/)
- [Лонгрид 4 — Spring MVC и RESTful-сервисы](/longreads/04-spring-mvc-rest/)
