---
title: "7. Kafka продьюсер"
description: "Архитектура продьюсера, KafkaTemplate / RoutingKafkaTemplate / ReplyingKafkaTemplate, throughput"
---

> Kafka продьюсер. Архитектура продьюсера. KafkaTemplate, RoutingKafkaTemplate, ReplyKafkaTemplate. Увеличение пропускной способности.

## Архитектура продьюсера

Продьюсер отправляет сообщения в топик. Внутренний конвейер:
1. **Сериализатор** превращает ключ/значение в байты.
2. **Partitioner** выбирает партицию: по хешу ключа (одинаковый ключ → одна партиция,
   гарантия порядка) или round-robin/sticky, если ключа нет.
3. Сообщение попадает в **буфер (RecordAccumulator)** и группируется в **батчи** по
   партициям.
4. Фоновый **I/O-поток (Sender)** отправляет батчи брокеру (лидеру партиции) и ждёт `acks`.
5. По подтверждению вызывается callback (`onCompletion`).

Отправка **асинхронна** по умолчанию (возвращает `Future`/callback).

## Гарантии и надёжность

- **`acks`** — `0`/`1`/`all` (см. вопрос 5): надёжность vs скорость.
- **`retries`** + `delivery.timeout.ms` — повтор при временных сбоях.
- **`enable.idempotence=true`** — идемпотентный продьюсер: исключает дубликаты при ретраях
  (exactly-once на запись), сохраняет порядок.
- **Transactions** — атомарная запись в несколько партиций/топиков.

## KafkaTemplate

Основной класс Spring для отправки (обёртка над `KafkaProducer`):
```java
@Autowired KafkaTemplate<String, UserEvent> kafkaTemplate;

kafkaTemplate.send("user-events", user.getId(), event)   // topic, key, value
    .whenComplete((result, ex) -> {
        if (ex == null) log.info("offset={}", result.getRecordMetadata().offset());
        else log.error("send failed", ex);
    });
```

## RoutingKafkaTemplate

Маршрутизирует сообщения в разные **продьюсеры/конфигурации** по имени топика (по
regex-паттерну). Полезно, когда для разных топиков нужны разные сериализаторы/настройки:
```java
// topic "audit.*" → один producer (например, со своим сериализатором),
// остальные → другой
```

## ReplyingKafkaTemplate

Реализует паттерн **request-reply** поверх Kafka (синхронный запрос-ответ): отправляет
сообщение в топик запросов и **ждёт ответ** в топике ответов (по correlation id):
```java
RequestReplyFuture<String, Req, Resp> future = replyingTemplate.sendAndReceive(record);
Resp resp = future.get().value();
```
На стороне обработчика — `@KafkaListener` с `@SendTo` для ответа. Используется реже (Kafka
ориентирована на async), но бывает нужно для синхронной интеграции.

## Увеличение пропускной способности

- **Батчинг**: `batch.size` (размер батча) + **`linger.ms`** (подождать накопления перед
  отправкой) — больше сообщений за запрос.
- **`compression.type`** (`lz4`/`snappy`/`zstd`) — сжатие батчей: меньше сети, выше throughput.
- **`buffer.memory`** — больше буфер под пиковую нагрузку.
- Больше **партиций** → больше параллелизма записи.
- Слать **асинхронно** (не блокироваться на `.get()` после каждого send).
- `acks=1` вместо `all`, если допустимо ослабить гарантии ради скорости (компромисс
  надёжность/throughput).

## 🔗 Смежные вопросы
- [Б3.5 — Kafka: основы (acks, ISR, партиции)](/block-3/05-kafka-basics/)
- [Б3.6 — Kafka консьюмер](/block-3/06-kafka-consumer/)

## 📚 Материалы
- [Лонгрид 14 — Event-Driven Architecture. Kafka](/longreads/14-kafka/)
