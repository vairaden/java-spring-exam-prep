---
title: "Лонгрид 7. Spring Data JPA и Hibernate"
description: "ORM, маппинг сущностей, JPA-репозитории"
---

## 1. Введение: ORM, JDBC, JPA, Hibernate, Spring Data JPA — как всё связано

### Что такое ORM?

**ORM (Object-Relational Mapping)** — это программная технология, которая позволяет отображать данные из реляционной базы данных (таблицы, строки, колонки) на объекты объектно-ориентированного языка (в нашем случае — Java). Это устраняет необходимость писать SQL-запросы вручную для каждой операции.

> **Пример**: таблица `courses` с колонками `id`, `title`, `author` → класс `Course` с полями `Long id`, `String title`, `String author`.

### Проблематика
- **Импедансное несоответствие**: различия между ООП-моделью (наследование, ссылки, коллекции) и реляционной моделью (таблицы, внешние ключи).
- **Производительность**: ORM может генерировать неоптимальные запросы (N+1 проблема).
- **Сложность отладки**: SQL скрыт за абстракцией, трудно понять, что именно выполняется.

---

### Что такое JDBC?

**JDBC (Java Database Connectivity)** — это стандартный API в Java для взаимодействия с реляционными базами данных на низком уровне. Он предоставляет:

- интерфейсы для подключения (`Connection`);
- выполнения запросов (`Statement`, `PreparedStatement`);
- обработки результатов (`ResultSet`).

Однако работа с JDBC требует:
- повторяющегося шаблонного кода (открытие/закрытие соединений);
- явного преобразования `ResultSet` в Java-объекты;
- ручного управления транзакциями.

> **Пример**: чтобы получить курс по ID, нужно написать SQL-запрос, выполнить его, обработать `ResultSet`, создать объект `Course` и закрыть ресурсы.

---

### Что такое JPA?

**JPA (Java Persistence API)** — это **спецификация**, а не реализация. Она определяет:
- аннотации (`@Entity`, `@Id`, `@Column`, `@ManyToOne` и др.);
- интерфейсы (`EntityManager`, `PersistenceContext`);
- жизненный цикл сущностей;
- правила поведения при сохранении, загрузке, удалении.

> **Важно**: JPA сам по себе ничего не делает — он лишь задаёт контракт. Для работы нужна **реализация**, например Hibernate.

---

### 🔹 Что такое Hibernate?

**Hibernate** — одна из самых зрелых и популярных реализаций JPA. Он:
- преобразует Java-объекты в SQL и обратно;
- управляет состоянием сущностей (managed/detached/transient);
- поддерживает lazy/eager загрузку связей;
- генерирует DDL-скрипты;
- реализует кэширование (первого и второго уровня);
- обеспечивает «грязное отслеживание» (dirty checking).

Hibernate работает через **сессию** (`Session`) или **менеджер сущностей** (`EntityManager`), которые отслеживают изменения в объектах.

---

### Что такое Spring Data JPA?

**Spring Data JPA** — высокоуровневая абстракция над JPA/Hibernate, интегрированная в экосистему Spring Boot. Он:

- автоматически создаёт реализации репозиториев на основе интерфейсов;
- генерирует запросы по именам методов (`findByTitleLike`);
- поддерживает пагинацию (`Pageable`), сортировку (`Sort`);
- интегрируется с транзакциями Spring (`@Transactional`);
- позволяет писать кастомные JPQL- или native-запросы через `@Query`.

---

## 2. Настройка Spring-проекта

###  Зависимости (Maven/Gradle)

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-jpa</artifactId>
</dependency>
<dependency>
    <groupId>org.postgresql</groupId>
    <artifactId>postgresql</artifactId>
</dependency>
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-core</artifactId>
</dependency>
```

- `spring-boot-starter-data-jpa` — подключает:
    - Hibernate как реализацию JPA,
    - Spring Data JPA,
    - транзакционную поддержку (`PlatformTransactionManager`).
- `postgresql` — драйвер JDBC для PostgreSQL. Можно заменить на `mysql-connector-java` и так далее.
- `flyway-core` — инструмент управления миграциями БД (альтернатива `hibernate.ddl-auto` в продакшене).

---

###  Конфигурация в `application.yml`

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/test_db
    username: postgres
    password: password
  jpa:
    show-sql: true
    open-in-view: false
    properties:
      hibernate:
        format_sql: true
    hibernate:
      ddl-auto: validate
```

#### Разбор параметров

- `spring.datasource.url` — URL подключения к СУБД. Формат зависит от драйвера.
- `spring.jpa.show-sql: true` — выводит все SQL-запросы, генерируемые Hibernate, в консоль. Полезно для отладки.
- `spring.jpa.properties.hibernate.format_sql: true` — делает SQL читаемым (переносы, отступы).
- `spring.jpa.open-in-view: false` — **отключает паттерн Open Session in View**, который держит сессию Hibernate открытой до конца HTTP-запроса. Это может привести к N+1 проблемам и утечкам памяти. **Рекомендуется всегда выключать.**
- `spring.jpa.hibernate.ddl-auto: validate` — проверяет соответствие сущностей и схемы БД без изменений.

#### Возможные значения `ddl-auto`

| Значение       | Действие                                                                 | Когда использовать             |
|----------------|--------------------------------------------------------------------------|--------------------------------|
| `none`         | Ничего не делает                                                         | Продакшен                      |
| `validate`     | Проверяет соответствие схемы и сущностей                                 | Продакшен                      |
| `update`       | Обновляет схему (добавляет колонки/таблицы)                              | Разработка                     |
| `create`       | Удаляет и создаёт схему при старте                                       | Тестирование                   |
| `create-drop`  | Создаёт при старте, удаляет при завершении                               | Тестирование                   |

> ️ **Рекомендация**: в продакшене **никогда не используй `ddl-auto: create` или `update`**. Используй Flyway или Liquibase для контроля над схемой.

---

## 3. Сущности Hibernate

###  Пример сущности

```java
@Entity
@Table(name = "courses")
public class Course {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "author", nullable = false, length = 100)
    private String author;

    @Column(name = "title", nullable = false)
    private String title;

    protected Course() {}

    public Course(String author, String title) {
        this.author = author;
        this.title = title;
    }

    // getters, setters
}
```

###  Разбор аннотаций

- `@Entity` — помечает класс как сущность ORM. Без этой аннотации Hibernate игнорирует класс.
- `@Table(name = "courses")` — явно указывает имя таблицы. Если не указано, используется имя класса в нижнем регистре (`course`).
- `@Id` — определяет первичный ключ. Обязательна для всех сущностей.
- `@GeneratedValue(strategy = GenerationType.IDENTITY)` — стратегия генерации ID:
    - `IDENTITY` — использует автоинкремент (PostgreSQL `SERIAL`, MySQL `AUTO_INCREMENT`). ID генерируется **после** выполнения `INSERT`;
    - `SEQUENCE` — использует отдельный объект БД (`CREATE SEQUENCE`). Подходит для массовой вставки, так как ID генерируется **до** `INSERT`.
- `@Column(...)` — настраивает колонку:
    - `name` — имя колонки;
    - `nullable = false` → `NOT NULL`;
    - `length = 100` → `VARCHAR(100)`.
- `protected Course()` — **обязательный защищённый конструктор без аргументов**. Hibernate использует его через рефлексию для создания proxy-объектов (например, при lazy-загрузке).

> 💡 **Почему `protected`, а не `private`?**  
> Потому что Hibernate создаёт подклассы сущностей (proxy) для реализации lazy-загрузки. Private-конструктор недоступен для подкласса.

---

## 4. Жизненный цикл сущности Hibernate

Сущность проходит через четыре состояния.

### 1. **Transient (новая)**

- Объект создан через `new`, но ещё не сохранён в БД.
- Не отслеживается Hibernate.
- Пример:

```java
Course course = new Course("author", "title"); // Transient
```

### 2. **Managed (Persisted)**

- Объект сохранён в БД и отслеживается в рамках текущей транзакции.
- Любые изменения автоматически попадут в БД при коммите **(dirty checking)**.
- Переход из Transient → Managed происходит при вызове `repository.save()` или `entityManager.persist()`.

```java
@Transactional
public Course createNewCourse(String name) {
    Course course = new Course(name);
    return courseRepository.save(course); // Теперь Managed
}
```

> **Dirty checking**: Hibernate сканирует все managed-сущности перед коммитом и генерирует `UPDATE`, если поля изменились.

### 3. **Detached**

- Объект был Managed, но транзакция завершена.
- Изменения больше не отслеживаются.
- Чтобы снова сделать Managed — нужно вызвать `save()` или `merge()`.

```java
// После завершения метода @Transactional
Course course = service.createNewCourse("Java"); // Detached

// В другом методе @Transactional:
course.setName("Advanced Java");
courseRepository.save(course); // Перевод в Managed + UPDATE
```

### 4. **Removed**

- Объект помечен на удаление.
- При коммите транзакции будет выполнен `DELETE`.

```java
@Transactional
public void deleteCourse(Long id) {
    Course course = courseRepository.findById(id).orElseThrow();
    courseRepository.delete(course); // Removed
}
```

### Flush и Commit

- **Flush** — момент, когда Hibernate сканирует Managed-сущности, определяет изменения и отправляет SQL в БД.
- При использовании `@Transactional` flush и commit происходят автоматически в конце метода.

>  **Можно вызвать flush вручную**: `entityManager.flush()` — полезно для получения сгенерированного ID до коммита.

---

## 5. JPA-репозитории в Spring

### Интерфейс репозитория

```java
@Repository
public interface CourseRepository extends JpaRepository<Course, Long> {
    List<Course> findByTitleLike(String title);
}
```

- `JpaRepository<T, ID>` — предоставляет CRUD-операции:
    - `save()`, `findById()`, `findAll()`, `delete()`, `count()`, `existsById()` и другие.
- Spring Data автоматически создаёт реализацию при старте контекста.
- Методы вроде `findByTitleLike` генерируют JPQL/SQL по соглашению:
    - `findByTitleLike("%" + title + "%")`.

> **Как это работает?**  
> Spring Data сканирует интерфейсы при старте, создаёт прокси через `JpaRepositoryFactoryBean` и внедряет их через DI.

### Как работает `save()`?

```java
@Transactional
public <S extends T> S save(S entity) {
    if (isNew(entity)) {
        em.persist(entity); // Transient → Managed
    } else {
        return em.merge(entity); // Detached → Managed
    }
}
```

- `persist()` — для новых сущностей (transient).
- `merge()` — для отсоединённых (detached), возвращает новый managed-объект.

>  **Важно**: `merge()` **не модифицирует исходный объект**, а возвращает новый managed-экземпляр!

---

## 6. Связи между сущностями

### ManyToOne (много к одному)

#### БД
```sql
CREATE TABLE lessons (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    text TEXT NOT NULL,
    course_id BIGINT REFERENCES courses(id)
);
```

#### Сущность `Lesson`

```java
@Entity
@Table(name = "lessons")
public class Lesson {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull private String title;
    @NotNull private String text;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "course_id")
    private Course course;
}
```

- `@ManyToOne` — связь «много уроков → один курс».
- `fetch = FetchType.LAZY` — связанный `Course` загружается только при обращении к полю `course`.
- `@JoinColumn(name = "course_id")` — указывает внешний ключ.

>  **LAZY работает только внутри транзакции!**  
> Если обратиться к `lesson.getCourse()` вне `@Transactional`, будет выброшено `LazyInitializationException`.

### OneToMany (один ко многим)

#### Сущность `Course`

```java
@Entity
@Table(name = "courses")
public class Course {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull private String author;
    @NotNull private String title;

    @OneToMany(mappedBy = "course")
    private List<Lesson> lessons = new ArrayList<>();
}
```

- `mappedBy = "course"` — указывает, что владеющей стороной связи является `Lesson`.
- Это **двусторонняя связь**: `Course` ←→ `Lesson`.

> **Правило**: владеющая сторона — та, где находится `@JoinColumn`. Именно она управляет внешним ключом.

---

## 7. Каскадные операции

Каскад — автоматическое применение операций к связанным сущностям.

### Типы каскадов

| Тип        | Действие                                                  |
|------------|-----------------------------------------------------------|
| `PERSIST`  | Сохранение дочерних при сохранении родителя               |
| `MERGE`    | Обновление дочерних при обновлении родителя               |
| `REMOVE`   | Удаление дочерних при удалении родителя                   |
| `REFRESH`  | Синхронизация дочерних с БД                               |
| `DETACH`   | Отсоединение дочерних                                     |
| `ALL`      | Все вышеперечисленные                                     |

### Пример: каскадное создание

```java
@OneToMany(mappedBy = "course", cascade = {CascadeType.PERSIST})
private List<Lesson> lessons = new ArrayList<>();

public void createLesson(String title, String content) {
    this.lessons.add(new Lesson(title, content, this));
}
```

При сохранении `Course` через `save(course)`, все новые `Lesson` также будут сохранены.

### Orphan Removal

```java
@OneToMany(mappedBy = "course", cascade = CascadeType.PERSIST, orphanRemoval = true)
private List<Lesson> lessons = new ArrayList<>();
```

- `orphanRemoval = true` — если элемент удаляется из коллекции (`lessons.remove(...)`), он удаляется из БД.
- Используется для удаления «осиротевших» дочерних записей.

### Cascade REMOVE — осторожно!

```java
@OneToMany(mappedBy = "course", cascade = CascadeType.REMOVE)
```

- При удалении `Course` удаляются **все** связанные `Lesson`.
- **Проблема**: генерируется N+1 DELETE-запросов (по одному на каждый `Lesson` + один на `Course`).
- **Решение**: лучше использовать `ON DELETE CASCADE` на уровне БД:

```sql
course_id BIGINT REFERENCES courses(id) ON DELETE CASCADE
```

Тогда при `DELETE FROM courses WHERE id = ?` СУБД сама удалит все связанные `lessons`.

>  **Best practice**: используй каскады только для `PERSIST` и `MERGE`. Для удаления — ограничения БД.

---

## 8. Выводы и рекомендации

1. **Hibernate** — мощная реализация JPA, но требует понимания жизненного цикла сущностей.
2. **Spring Data JPA** — значительно упрощает работу, но не отменяет необходимости знать основы Hibernate.
3. **Сущности мутабельны** — их можно менять в рамках транзакции, и изменения автоматически синхронизируются с БД.
4. **Lazy-загрузка** — мощный инструмент, но требует транзакции. Используй DTO или `JOIN FETCH` для избежания `LazyInitializationException`.
5. **Каскады** — удобны, но могут привести к проблемам с производительностью. Предпочитай `ON DELETE CASCADE` в БД.
6. **Flyway/Liquibase** — обязательны в продакшене вместо `ddl-auto`.
7. **Open Session in View** — отключай (`open-in-view: false`), чтобы избежать скрытых запросов и утечек.

---
