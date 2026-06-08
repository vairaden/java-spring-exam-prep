---
title: "13. Rate Limiter и Circuit Breaker (Resilience4j)"
description: "Паттерны отказоустойчивости, Resilience4j в Spring Boot"
---

> Rate limiter и Circuit breaker. Resilience4j в Spring Boot.

## Зачем нужна отказоустойчивость

При вызове внешних сервисов сбои неизбежны (таймауты, перегрузка). Без защиты медленный
upstream «съедает» потоки и вызывает **каскадный отказ**. **Resilience4j** — легковесная
библиотека паттернов отказоустойчивости, интегрированная со Spring Boot (на аннотациях).

## Circuit Breaker (предохранитель)

Защищает от каскадных отказов: «размыкает цепь» к падающему сервису, чтобы не долбить его и
быстро отдавать fallback. Состояния:
- **CLOSED** — запросы проходят; считается доля ошибок.
- **OPEN** — порог ошибок превышен → запросы **не идут**, сразу fallback (даёт сервису
  восстановиться).
- **HALF_OPEN** — через паузу пропускает пробные запросы; успех → CLOSED, неудача → OPEN.

```java
@CircuitBreaker(name = "taskService", fallbackMethod = "fallback")
public Task getTask(Long id) {
    return restClient.get().uri("/tasks/{id}", id).retrieve().body(Task.class);
}
public Task fallback(Long id, Throwable t) {
    return Task.placeholder(id);   // деградация вместо ошибки
}
```
```yaml
resilience4j.circuitbreaker.instances.taskService:
  sliding-window-size: 10
  failure-rate-threshold: 50          # % ошибок для OPEN
  wait-duration-in-open-state: 10s
  permitted-number-of-calls-in-half-open-state: 3
```

## Rate Limiter (ограничитель частоты)

Ограничивает **число вызовов за период** — защищает свой/чужой сервис от перегрузки,
соблюдает квоты внешнего API. Превышение → ожидание или `RequestNotPermitted`.
```java
@RateLimiter(name = "externalApi", fallbackMethod = "fallback")
public Data call() { ... }
```
```yaml
resilience4j.ratelimiter.instances.externalApi:
  limit-for-period: 100         # запросов
  limit-refresh-period: 1s      # за период
  timeout-duration: 0           # сколько ждать слота
```

## Другие паттерны Resilience4j

- **Retry** — повтор при временной ошибке (с backoff):
  `@Retry(name = "...")`, `max-attempts`, `wait-duration`.
- **Bulkhead** — изоляция ресурсов: ограничивает число **параллельных** вызовов, чтобы один
  сервис не выел все потоки.
- **TimeLimiter** — таймаут на асинхронный вызов.

## Порядок применения и интеграция

При комбинации аннотаций порядок по умолчанию (снаружи внутрь):
`Retry → CircuitBreaker → RateLimiter → TimeLimiter → Bulkhead`.

Подключение и метрики:
```gradle
implementation 'io.github.resilience4j:resilience4j-spring-boot3'
```
Resilience4j публикует метрики в Micrometer/Actuator (состояние брейкера, доля ошибок) —
их видно в Prometheus/Grafana.

## 🔗 Смежные вопросы
- [Б2.12 — RestClient (что защищаем)](/block-2/12-restclient/)
- [Б3.9 — Actuator и Micrometer (метрики брейкера)](/block-3/09-actuator/)

## 📚 Материалы
- [Лонгрид 10 — HTTP-запросы и ответы. RestClient](/longreads/10-http-restclient/)
