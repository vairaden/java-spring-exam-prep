---
title: "9. Пагинация и сортировка"
description: "Pageable, Page/Slice, Sort, keyset-пагинация"
---

> Hibernate. Пагинация и сортировка.

## Зачем пагинация

Загружать всю таблицу в память дорого и опасно. Пагинация возвращает данные **постранично**
(`LIMIT`/`OFFSET`), снижая нагрузку на память и сеть.

## Pageable и Page

Spring Data принимает **`Pageable`** и возвращает **`Page`/`Slice`**:
```java
public interface TaskRepository extends JpaRepository<Task, Long> {
    Page<Task> findByStatus(Status status, Pageable pageable);
}

// вызов
Pageable pageable = PageRequest.of(0, 20, Sort.by("createdAt").descending());
Page<Task> page = repo.findByStatus(Status.OPEN, pageable);

page.getContent();        // элементы страницы
page.getTotalElements();  // всего записей
page.getTotalPages();
page.hasNext();
```

**`Page` vs `Slice`:**
- **`Page`** — знает **общее число** элементов/страниц → выполняет **дополнительный
  `COUNT`-запрос**.
- **`Slice`** — знает только, есть ли следующая страница (грузит `limit + 1`), **без COUNT**
  → дешевле, если total не нужен (бесконечная прокрутка).

## Сортировка

Через **`Sort`** (отдельно или внутри `PageRequest`):
```java
Sort sort = Sort.by("priority").descending().and(Sort.by("title").ascending());
List<Task> tasks = repo.findAll(sort);
repo.findAll(PageRequest.of(1, 10, sort));
```
Поля сортировки — имена свойств сущности (Spring транслирует в `ORDER BY` колонок).

## В REST-контроллере

Spring MVC умеет биндить `Pageable` из query-параметров `?page=0&size=20&sort=createdAt,desc`:
```java
@GetMapping("/tasks")
public Page<TaskResponseDto> list(Pageable pageable) {
    return repo.findAll(pageable).map(mapper::toDto);
}
```

## OFFSET-пагинация и её минус

`LIMIT/OFFSET` при больших `OFFSET` **медленный** (БД отбрасывает все пропущенные строки) и
может «сдвигать» данные при вставках между запросами.

## Keyset (cursor) пагинация

Альтернатива: фильтровать по значению последнего ключа предыдущей страницы, без OFFSET:
```sql
SELECT * FROM tasks WHERE id > :lastId ORDER BY id LIMIT 20;
```
Стабильна и быстра на больших объёмах; подходит для бесконечной ленты. Минус — нельзя
прыгнуть на произвольную страницу.

## 🔗 Смежные вопросы
- [Б2.8 — Производительность, N+1](/block-2/08-performance/)
- [Б2.10 — Spring Data, JPQL/HQL](/block-2/10-spring-data/)

## 📚 Материалы
- [Лонгрид 8 — Продвинутый Spring Data JPA](/longreads/08-spring-data-advanced/)
