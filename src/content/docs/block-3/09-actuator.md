---
title: "9. Spring Actuator и Micrometer"
description: "Эндпоинты Actuator, Micrometer, интеграция с Prometheus и Grafana, оверхед метрик"
---

> Spring Actuator: эндпоинты, конфигурации. Micrometer: SDK, интеграция с Prometheus и Grafana. Производительность и оверхед при использовании метрик.

## Spring Boot Actuator

Модуль production-ready возможностей: метрики, health-checks, информация о приложении через
HTTP-эндпоинты.
```gradle
implementation 'org.springframework.boot:spring-boot-starter-actuator'
```

**Ключевые эндпоинты** (`/actuator/...`):
- **`/health`** — состояние приложения и зависимостей (БД, диск, Kafka); используется
  liveness/readiness-пробами Kubernetes.
- **`/metrics`** — метрики (JVM, HTTP, пулы) в формате Actuator.
- **`/prometheus`** — метрики в формате Prometheus (для scrape).
- **`/info`** — произвольная информация о сборке/приложении.
- **`/loggers`** — просмотр и **изменение уровней логирования в рантайме**.
- **`/env`**, `/beans`, `/mappings`, `/threaddump`, `/heapdump`.

## Конфигурация Actuator

По умолчанию наружу открыт только `health`. Эндпоинты включают/настраивают явно:
```yaml
management:
  endpoints.web.exposure.include: health,info,prometheus,metrics
  endpoint.health.show-details: when-authorized
  metrics.tags.application: task-service        # общий тег для всех метрик
```
Чувствительные эндпоинты (`env`, `heapdump`) нужно **защищать** (Security) или не открывать
наружу — выносят на отдельный порт `management.server.port`.

## Micrometer

**Micrometer** — «SLF4J для метрик»: вендоронезависимый **фасад** (SDK) для метрик. Код
пишет к API Micrometer (`Counter`, `Gauge`, `Timer`, `DistributionSummary`), а конкретный
**backend** (Prometheus, Graphite, Datadog, New Relic) подключается registry-зависимостью.
Actuator под капотом использует Micrometer.
```java
@Autowired MeterRegistry registry;

Counter created = registry.counter("tasks.created");
created.increment();

Timer timer = registry.timer("tasks.process.time");
timer.record(() -> service.process());
// @Timed("...") на методе
```

## Интеграция Prometheus + Grafana

```
Spring App (Micrometer → /actuator/prometheus)
        ▲ scrape (pull)
   Prometheus (TSDB, хранит метрики, PromQL, alerting)
        ▲ запросы
     Grafana (дашборды, визуализация)
```
- **Prometheus** периодически **скрейпит** (pull) `/actuator/prometheus`, хранит time-series,
  выполняет запросы PromQL и алерты.
- **Grafana** строит дашборды поверх Prometheus.
```gradle
implementation 'io.micrometer:micrometer-registry-prometheus'
```

## Производительность и оверхед

- **Counter/Gauge** — почти бесплатны (атомарный инкремент/чтение).
- **Histogram/Timer с перцентилями** — дороже: память на корзины, особенно при **высокой
  кардинальности тегов**.
- **Кардинальность — главный риск**: тег с уникальными значениями (userId, путь с id,
  request id) порождает тысячи time-series → взрыв памяти Prometheus и приложения. Теги
  должны иметь **ограниченный набор значений** (метод, статус, endpoint-шаблон).
- **Pull-модель** Prometheus дешевле push; scrape-интервал балансирует свежесть и нагрузку.
- Для горячих путей — лёгкие метрики; перцентили включать осознанно
  (`distribution.percentiles-histogram`).

## 🔗 Смежные вопросы
- [Б3.8 — Метрики и золотые сигналы](/block-3/08-monitoring-metrics/)
- [Б2.13 — Resilience4j (метрики брейкера)](/block-2/13-resilience4j/)
- [Б1.17 — Логирование и MDC](/block-1/17-logging/)

## 📚 Материалы
- [Лонгрид 15 — Мониторинг Spring-приложений](/longreads/15-monitoring/)
