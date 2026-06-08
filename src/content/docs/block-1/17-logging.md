---
title: "17. Логирование: SLF4J, уровни, MDC"
description: "SLF4J и реализации, уровни логирования, конфигурация, MDC"
---

> Логирование. SLF4J и реализации. Уровни логирования, конфигурация. MDC.

## SLF4J — фасад логирования

**SLF4J** (Simple Logging Facade for Java) — это **абстракция (фасад)** над библиотеками
логирования. Код пишет к API SLF4J, а конкретная реализация подключается на classpath.
Это позволяет менять движок без изменения кода.

```java
private static final Logger log = LoggerFactory.getLogger(TaskService.class);
log.info("Created task id={}", id);   // {} — ленивая подстановка, без конкатенации строк
```

## Реализации (backends)

- **Logback** — нативная реализация SLF4J, **дефолт в Spring Boot**.
- **Log4j2** — производительная альтернатива (асинхронные логгеры).
- **java.util.logging (JUL)** — встроенный в JDK.

SLF4J соединяется с реализацией через **binding/bridge**. Spring Boot предоставляет
`spring-boot-starter-logging` (SLF4J + Logback) и **мосты** (`jul-to-slf4j`,
`log4j-to-slf4j`), чтобы перенаправить чужое логирование в единый бэкенд.

## Уровни логирования

От самого подробного к самому важному:
`TRACE` < `DEBUG` < `INFO` < `WARN` < `ERROR`.

Логгер с уровнем `INFO` пропускает `INFO`, `WARN`, `ERROR` и подавляет `DEBUG`/`TRACE`.
- `TRACE`/`DEBUG` — диагностика для разработки.
- `INFO` — значимые события (старт, обработанный запрос).
- `WARN` — потенциальная проблема, работа продолжается.
- `ERROR` — сбой операции.

## Конфигурация

В Spring Boot — через `application.yaml`:
```yaml
logging:
  level:
    root: INFO
    com.example.service: DEBUG
    org.hibernate.SQL: DEBUG
  pattern:
    console: "%d{HH:mm:ss} [%thread] %-5level %logger{36} - %msg%n"
  file:
    name: logs/app.log
```
Для тонкой настройки — `logback-spring.xml` (appenders: console/file/rolling, форматтеры,
профиль-специфичные секции `<springProfile>`).

## MDC (Mapped Diagnostic Context)

**MDC** — потоко-локальное хранилище «контекста» (ключ→значение), которое автоматически
подставляется в каждую строку лога этого потока. Главное применение — **корреляция логов
одного запроса** (`traceId`, `userId`):
```java
MDC.put("requestId", UUID.randomUUID().toString());
try {
    log.info("processing");   // в логе появится requestId
} finally {
    MDC.clear();              // обязательно очищать — поток переиспользуется из пула!
}
```
Вывод MDC в паттерне: `%X{requestId}`. Обычно MDC заполняется в `Filter`/`Interceptor` в
начале запроса и очищается в конце.

Важно: MDC привязан к потоку, поэтому в асинхронном/реактивном коде (другой поток) его надо
**пробрасывать вручную** (`TaskDecorator`, в Reactor — через Context). При логировании
нельзя писать в логи чувствительные данные (пароли, токены, ПДн).

## 🔗 Смежные вопросы
- [Б1.15 — Обработка ошибок](/block-1/15-error-handling/)
- [Б3.9 — Actuator и Micrometer (эндпоинт /loggers, MDC→трейсинг)](/block-3/09-actuator/)
- [Б1.18 — Тестирование](/block-1/18-testing/)

## 📚 Материалы
- Концепция логирования упоминается в [Лонгрид 4](/longreads/04-spring-mvc-rest/) и
  [Лонгрид 11 — Тестирование](/longreads/11-testing/); отдельной лекции нет — ответ по
  стандартной практике Spring/SLF4J.
