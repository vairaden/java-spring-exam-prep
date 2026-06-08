---
title: "6. Kafka консьюмер"
description: "Архитектура консьюмера, конфигурации, batch-консьюмер, повышение пропускной способности"
---

> Kafka консьюмер. Архитектура консьюмера. Конфигурации консьюмера. Batch консьюмер. Увеличение пропускной способности.

## Архитектура консьюмера

Консьюмер в цикле опрашивает брокер (**poll loop**): `poll()` забирает пачку сообщений из
назначенных партиций, приложение их обрабатывает, затем коммитит offset. Консьюмеры
объединяются в **группы** (см. вопрос 5); партиции распределяются между ними, при изменении
состава — **rebalance**. Консьюмер шлёт **heartbeat**, чтобы группа считала его живым.

В Spring — `@KafkaListener` поверх `KafkaConsumer`, контейнер слушателя управляет poll loop:
```java
@KafkaListener(topics = "user-events", groupId = "user-service")
public void onMessage(UserEvent event) {
    service.handle(event);
}
```

## Ключевые конфигурации

- **`group.id`** — идентификатор группы.
- **`enable.auto.commit`** — авто-коммит offset (по времени) vs ручной коммит.
  Ручной (`AckMode.MANUAL`) надёжнее: коммит **после** успешной обработки (семантика
  at-least-once).
- **`auto.offset.reset`** — `earliest` (с начала) / `latest` (с конца) при отсутствии offset.
- **`max.poll.records`** — максимум сообщений за один `poll()`.
- **`max.poll.interval.ms`** — макс. время между poll'ами; превышение → консьюмер считается
  «зависшим», происходит rebalance.
- **`fetch.min.bytes` / `fetch.max.wait.ms`** — батчинг на стороне брокера (ждать накопления
  данных → выше throughput, чуть выше latency).
- **`session.timeout.ms` / `heartbeat.interval.ms`** — детект «мёртвого» консьюмера.

## Семантика доставки

- **at-most-once** — коммит до обработки (можно потерять).
- **at-least-once** — коммит после обработки (возможны дубликаты → нужна идемпотентность).
- **exactly-once** — транзакции Kafka + idempotent producer (сложнее, дороже).

## Batch консьюмер

Обрабатывать сообщения **пачкой** за один вызов вместо по одному — меньше накладных
расходов, выше throughput (например, батч-вставка в БД):
```java
@KafkaListener(topics = "user-events", batch = "true")
public void onBatch(List<UserEvent> events) {
    service.saveAll(events);   // одна транзакция/батч-вставка на пачку
}
```
```java
factory.setBatchListener(true);
```

## Увеличение пропускной способности

- **Больше партиций** + больше консьюмеров в группе (до числа партиций) → больше параллелизма.
- **Конкурентность контейнера**: `@KafkaListener(concurrency = "3")` — несколько потоков на инстанс.
- **Batch-обработка** и батч-операции с БД.
- Тюнинг `fetch.min.bytes`/`max.poll.records` (баланс throughput/latency).
- **Идемпотентная** обработка → можно использовать дешёвый at-least-once без exactly-once.
- Минимизировать время обработки (не блокировать poll loop долгими операциями; тяжёлое —
  в отдельный пул).

## 🔗 Смежные вопросы
- [Б3.5 — Kafka: основы (topic, partition, offset)](/block-3/05-kafka-basics/)
- [Б3.7 — Kafka продьюсер](/block-3/07-kafka-producer/)

## 📚 Материалы
- [Лонгрид 14 — Event-Driven Architecture. Kafka](/longreads/14-kafka/)
