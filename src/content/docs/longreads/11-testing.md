---
title: "Лонгрид 11. Тестирование Spring-приложений"
description: "Unit, интеграционные и E2E тесты, MockMvc, Testcontainers"
---

## 1. Введение в тестирование и архитектура

### Тестирование как часть архитектуры
В современной разработке тестирование — это не отдельный этап перед релизом, а неотъемлемая часть архитектуры приложения.

**Проблематика**

Если код невозможно протестировать автоматически, это сигнал о плохой архитектуре. Чаще всего это проявляется:
*   в **высокой связности (High Coupling)**: классы слишком сильно зависят друг от друга;
*   **отсутствии инверсии зависимостей (No DIP)**: зависимости создаются внутри классов через `new`, а не внедряются;
*   **глобальном состоянии**: использование статических переменных, усложняющих изоляцию тестов.

**Ключевые вопросы тестирования**
1.  **Какие тесты бывают?** (Юнит, интеграционные, E2E.)
2.  **Как понять, что тестов достаточно?** (Покрытие критических путей, бизнес-логики.)
3.  **Разделение ответственности**: разработчики пишут юнит-тесты и интеграционные тесты кода, QA-инженеры фокусируются на E2E, ручном и исследовательском тестировании.

---

## 2. Виды тестирования: пирамида тестирования

**Пирамида тестирования** — это концепция, описывающая оптимальное соотношение видов тестов. Чем ниже уровень пирамиды, тем тесты должны быть быстрее, дешевле и их должно быть больше.

### Уровни пирамиды (снизу вверх)

1.  **Статический анализ (Static Analysis)**
    *   **Что это**: проверка кода без его выполнения.
    *   **Инструменты**: линтеры (Checkstyle, ESLint), форматтеры, компиляторы (проверка типов).
    *   **Цель**: поиск потенциальных ошибок и соблюдение стандартов кодирования до запуска тестов.
    *   **Скорость**: мгновенно.

2.  **Модульное/юнит-тестирование (Unit Testing)**
    *   **Что это**: тестирование мельчайших изолированных частей кода (функций, методов, классов).
    *   **Кто пишет**: разработчики.
    *   **Особенности**: зависимости изолируются (мокаются). Не требуется инфраструктура (БД, сеть).
    *   **Скорость**: очень быстро (миллисекунды).
    *   **Количество**: самый большой слой пирамиды.

3.  **Интеграционное тестирование (Integration Testing)**
    *   **Что это**: проверка взаимодействия между несколькими модулями или компонентами (сервис + БД, контроллер + сервис).
    *   **Цель**: выявить ошибки на стыке компонентов (проблемы маппинга, SQL, транзакции).
    *   **Скорость**: медленнее юнит-тестов (требуется подъём инфраструктуры).
    *   **Количество**: средний слой.

4.  **Сквозное тестирование (End-to-End/E2E)**
    *   **Что это**: тестирование системы целиком с точки зрения пользователя (UI-тесты, симуляция сценариев).
    *   **Особенности**: самые медленные, дорогие в поддержке и хрупкие.
    *   **Количество**: минимальное (только ключевые сценарии).

---

## 3. Виды тестирования по времени и целям

### По времени в SDLC (жизненный цикл разработки)
*   **Дымовое тестирование (Smoke Testing).** Короткий цикл проверки критичной функциональности. Если не проходит — сборка нестабильна («дышит — не дышит»).
*   **Тестирование новых функций (New Feature Testing).** Проверка конкретного реализованного функционала.
*   **Регрессионное тестирование (Regression Testing).** Проверка того, что новые изменения не сломали существующую работающую функциональность.

### По целям
*   **Функциональное**
    *   *Functional.* Проверка бизнес-функций (логин, заказ).
    *   *Security.* Уязвимости, права доступа.
    *   *Interoperability.* Работа с внешними системами.
    *   *Installation.* Установка и обновление.
*   **Нефункциональное**
    *   *Performance.* Нагрузочное, стрессовое тестирование.
    *   *UI.* Графический интерфейс (расположение, шрифты).
    *   *Usability.* Удобство для пользователя.
    *   *Reliability.* Надёжность работы без сбоев.

---

## 4. Школы тестирования (философия Unit-тестов)

Существует два основных подхода к написанию юнит-тестов. Выбор подхода влияет на использование инструментов (Mockito vs реальные зависимости).

### 1. Лондонская школа (Mockist / London School)
**Суть**: тест проверяет **взаимодействие** объектов. Важно, чтобы объект вызвал нужные методы с нужными аргументами.
**Зависимости**: все зависимости изолируются моками (Mock).

**Пример кода**
```java
public class UserServiceTest {
    @Mock // Подменяем зависимости моком
    private UserRepository userRepository; 
    private UserService userService; 

    @BeforeEach
    void setUp() {
        // Создаём сервис, внедряя в него мок репозитория
        userService = new UserService(userRepository);
    }

    @Test
    void testCreateUser() {
        User user = userService.createUser("Alice"); 
        // Проверяем ВЗАИМОДЕЙСТВИЕ (Interaction Verification):
        // точно ли был вызван метод save?
        verify(userRepository).save(user);
    } 
}
```
**Пояснение**
*   `@Mock` — аннотация Mockito, создающая пустую реализацию интерфейса.
*   `verify(...)` — проверка того, что метод был вызван. Работает только на мокнутом объекте.
*   **Плюсы**: тесты очень быстрые, не требуют инфраструктуры (БД).
*   **Минусы**: тесты хрупкие. Если изменить внутреннюю реализацию сервиса (например, перестать вызывать `save` в определённом месте, но логика сохранится), тест упадет.

### 2. Детройская школа (Classicist / Chicago School)
**Суть**: тест проверяет **состояние** (State Verification). Нам важен конечный результат, а не путь его достижения.
**Зависимости**: все зависимости — реальные (но легковесные, например in-memory БД). Моки ставятся только на границе системы (внешние API, сеть).

**Пример кода**
```java
public class UserServiceTest2 {
    // 1. Используем РЕАЛЬНЫЕ зависимости или лёгкие заглушки
    private UserRepository userRepository; 
    private UserService userService; 

    @BeforeEach
    void setUp() {
        // Создаём реальную (или ин-мемори) реализацию репозитория
        userRepository = new InMemoryUserRepository(); 
        userService = new UserService(userRepository);
    }

    @Test
    void testCreateUser() {
        // Arrange & Act
        String username = "Alice"; 
        userService.createUser(username);
        
        // Assert: проверяем СОСТОЯНИЕ (State Verification)
        // Нам важно, что пользователь теперь существует в хранилище.
        User savedUser = userRepository.findByName(username); 
        assertNotNull(savedUser, "Пользователь должен быть сохранен"); 
        assertEquals("Alice", savedUser.getName());
    } 
}
```
**Пояснение**
*   `InMemoryUserRepository` — реализация интерфейса, хранящая данные в памяти (список/мапа), без реальной БД.
*   `assertNotNull`, `assertEquals` — проверка результата работы, а не вызовов методов.
*   **Плюсы**: тесты устойчивы к рефакторингу внутренней реализации.
*   **Минусы**: требует больше инфраструктуры (например, настройка in-memory хранилищ).

---

## 5. Подготовка к тестированию в Spring Boot

### Зависимости (build.gradle)
Для тестирования необходимо добавить стартеры в секцию `testImplementation`:
```groovy
testImplementation 'org.springframework.boot:spring-boot-starter-test'
testImplementation 'org.springframework.boot:spring-boot-starter-data-jdbc-test'
testImplementation 'org.springframework.boot:spring-boot-starter-data-jpa-test'
testImplementation 'org.springframework.boot:spring-boot-starter-flyway-test'
testImplementation 'org.springframework.boot:spring-boot-starter-jdbc-test'
testImplementation 'com.h2database:h2:2.4.240'
```
**Пояснение**
*   `spring-boot-starter-test` — включает JUnit, Mockito, AssertJ, Spring Test.
*   `spring-boot-starter-XXX-test` — включают дополнительные абстракции тестирования под соответствующую зависимость.
*   `h2` — база данных в памяти для быстрых тестов.

### Конфигурация (application-test.yml)
```yaml
spring:
  datasource:
    # Для юнит-тестов часто используют H2
    url: jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE
    username: sa
    password: 
    driver-class-name: org.h2.Driver
```
**Важно**: отключай внешние интеграции (email, сервисы) в профиле `test`, заменяя их моками или заглушками.

---

## 6. Spring Testing под капотом

### Ключевые компоненты
1.  **TestContext** — объект, хранящий состояние теста (ApplicationContext, текущий метод, статус).
2.  **TestContextManager** — главный оркестратор. Создаётся для каждого тестового класса. Управляет жизненным циклом теста.
3.  **TestExecutionListener** — слушатели, выполняющие действия до/после тестов:
    *   `DependencyInjectionTestExecutionListener` — внедряет зависимости (`@Autowired`, `@Value`);
    *   `TransactionalTestExecutionListener` — управляет транзакциями (`@Transactional` в тестах);
    *   `SqlScriptsTestExecutionListener` — выполняет скрипты `@Sql`;
    *   `EventPublishingTestExecutionListener` — публикует события тестирования.
4.  **ContextCache** — статический кеш ApplicationContext'ов.

### Кеширование контекста и @DirtiesContext
Spring кеширует контексты для ускорения запуска тестов. Если ты изменишь бин в одном тесте (например, через `@MockBean`), это изменение может «протечь» в другие тесты, использующие тот же кеш.

**Аннотация `@DirtiesContext`** помечает контекст как «грязный», требующий перезагрузки.

**Аргументы**
1.  `classMode`:
    *   `AFTER_CLASS` (default) — перезагрузить контекст после всего класса тестов;
    *   `BEFORE_CLASS` — перезагрузить перед классом;
    *   `AFTER_EACH_TEST_METHOD` — перезагружать после каждого метода (очень медленно!).
2.  `methodMode`: `AFTER_METHOD`, `BEFORE_METHOD`.

**Нюанс**: используй `@DirtiesContext`, только когда это действительно необходимо, так как перезагрузка контекста значительно замедляет прогон тестов.

---

## 7. Юнит-тестирование сервисов (@SpringBootTest)

### Пример сервиса (UserService)
```java
@Service 
@RequiredArgsConstructor
public class UserService {
    private final UserRepository userRepository; 

    @Transactional
    public User createUser(User user) {
        if (userRepository.existsByEmail(user.getEmail())) {
            throw new RuntimeException("Email already exists"); 
        }
        return userRepository.save(user);
    }
}
```

### Тест сервиса
```java
@SpringBootTest(
    webEnvironment = WebEnvironment.NONE, // Не поднимаем веб-контейнер
    properties = { "any.property= example_value" }, // Переопределение любых свойств
    classes = { UserService.class } // Указываем классы для загрузки (сужаем контекст)
)
@ActiveProfiles("test") // Активируем профиль test (application-test.yml)
class UserServiceTest {

    @Autowired 
    private UserService userService; 
    
    @MockitoBean // Замена бина в контексте на Mockito-мок (аналог @MockBean)
    private UserRepository userRepository; 

    @BeforeEach
    void clean() {
        // Бесполезно, так как это мок, у него нет реальной базы
        userRepository.deleteAll(); 
    }

    @Test
    void shouldCreateUser() {
        // Given
        User user = new User("john_doe", "john@example.com", 25);
        // Настройка поведения мока
        Mockito.doReturn(user).when(userRepository).save(Mockito.eq(user));
        Mockito.doReturn(false).when(userRepository).existsByEmail(Mockito.eq(user.getEmail()));
        
        // When
        User savedUser = userService.createUser(user);
        
        // Then
        assertThat(savedUser.getUsername()).isEqualTo("john_doe");
        assertThat(savedUser.getEmail()).isEqualTo("john@example.com");
        assertThat(savedUser.getAge()).isEqualTo(25);
    }
}
```

### Разбор аннотаций
*   `@SpringBootTest` — запускает полный Spring контекст (ApplicationContext).
    *   `webEnvironment` — управляет веб-слоем (`RANDOM_PORT`, `DEFINED_PORT`, `NONE`).
    *   `classes` — указать конкретные классы конфигурации (если нужно переопределить автоматический поиск).
    *   `properties` — задать тестовые свойства, приоритет над `application.yml`.
*   `@ActiveProfiles("test")` — заставляет Spring загружать конфигурационные файлы `application-test.yml`.
*   `@MockitoBean` — предназначена для замены бинов в тестовом ApplicationContext на Mockito-моки. Пришла на смену устаревшей `@MockBean`. По умолчанию тип мока определяется по типу поля.

---

## 8. Тестирование контроллеров (Slice Tests)

### Цель
Проверить HTTP-слой (маппинг, валидация, конвертация JSON, коды ответов).
**Что грузит**: контроллеры, `@ControllerAdvice`, Filter, Jackson, Validator.
**Что НЕ грузит**: сервисы, репозитории, БД.

### Пример контроллера
```java
@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;

    @GetMapping("/{id}")
    public ResponseEntity<User> getUserById(@PathVariable Long id) {
        final User user = userService.getUserById(id).orElseThrow(UserNotFoundException::new);
        return ResponseEntity.ok(user);
    }
}
```

### Тест контроллера
```java
@WebMvcTest(
    controllers = { UserController.class }, // Загружаем только этот контроллер
    properties = { "any.property= example_value" }
)
class UserControllerUnitTest {

    @Autowired 
    private MockMvc mockMvc; // Виртуальный HTTP-клиент
    
    @MockitoBean // Заменяем реальный сервис на мок в контексте
    private UserService userService;

    @Test
    void should404WhenUserNotFund() throws Exception {
        // Настройка мока
        Mockito.doAnswer(invocationOnMock -> Optional.empty())
            .when(userService).getUserById(123L);
            
        // Запрос через виртуальный клиент
        mockMvc.perform(get("/api/v1/users/123"))
            .andExpect(status().isNotFound()) // Ожидаем статус 404
            .andExpect(jsonPath("$.message").exists()); // Проверка тела ответа
    }
}
```

### Разбор аннотаций
*   `@WebMvcTest` — позволяет тестировать контроллеры Spring MVC без загрузки всего контекста приложения. Загружает только слой MVC.
*   `MockMvc` — виртуальный браузер. Позволяет отправлять HTTP-запросы внутри JVM без реального сетевого вызова.
*   **Важно**: все зависимости контроллера (сервисы, репозитории) нужно мокать вручную (`@MockitoBean`), так как они не загружаются в контекст автоматически.

---

## 9. Интеграционное тестирование репозиториев

### Цель
Проверить корректность описанных SQL-запросов и настроенной интеграции с БД.

### Пример репозитория
```java
@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);
    boolean existsByEmail(String email);
}
```

### Тест репозитория
```java
@DataJpaTest
@ActiveProfiles("test")
class UserRepositoryUnitTest {

    @Autowired 
    private UserRepository userRepository; 
    
    @Autowired 
    private TestEntityManager entityManager; // Предоставляет удобный API для тестов

    @Test
    void shouldFindUserByUsername() {
        // given
        User user = new User();
        user.setUsername("ivan_dev");
        user.setEmail("ivan@example.com");
        // Сохраняем и сбрасываем данные в БД
        User savedUser = entityManager.persistAndFlush(user); 
        
        // when
        Optional<User> foundUser = userRepository.findByUsername("ivan_dev");
        
        // then
        assertThat(foundUser).isPresent();
        assertThat(foundUser.get().getId()).isEqualTo(savedUser.getId());
        assertThat(foundUser.get().getEmail()).isEqualTo("ivan@example.com");
    }
}
```

### Разбор аннотаций и нюансов
*   `@DataJpaTest` — основная аннотация для тестирования работы с БД.
    *   **Ограниченный контекст**: сканирует только компоненты JPA (`@Entity`, `@Repository`). Сервисы и контроллеры не загружаются.
    *   **Автоматическая настройка БД**: конфигурирует БД в памяти (H2), создаёт схему таблиц на основе `@Entity`.
    *   **Транзакционность**: каждый тестовый метод оборачивается в транзакцию.
*   `TestEntityManager` — обёртка над `EntityManager`, предоставляющая более удобный API для тестов (например, `persistAndFlush`).
*   **Откат транзакций**: по умолчанию `@DataJpaTest` запускает каждый тест в транзакции, которая откатывается (rollback) в конце метода.
    *   **Плюс**: не нужно чистить базу данных вручную между тестами.
    *   **Нюанс**: если используешь методы, явно вызывающие коммит, это может нарушить изоляцию.
*   **Миграции**: по умолчанию `@DataJpaTest` не применяет миграции (Flyway/Liquibase), а создаёт схему через `hibernate.hbm2ddl.auto=create-drop`. Если нужно проверить скрипты миграции, добавь `@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)`.

### Проблемы @DataJpaTest через H2
1.  **Различия в диалектах SQL.** То, что работает в H2, может быть невалидным в PostgreSQL.
2.  **Разное поведение транзакций.** Уровни изоляции и блокировки могут отличаться.
3.  **Проблемы с миграциями.** H2 может «прощать» синтаксические ошибки, специфичные для другой БД.
4.  **Сложность отладки.** Тест проходит на CI (H2), но падает на стейджинге (Postgres).

---

## 10. Testcontainers (тестирование на реальной БД)

**Testcontainers** — это Java-библиотека, позволяющая управлять Docker-контейнерами прямо из кода тестов (JUnit).

### Преимущества
*   **Быстрый старт.** Не нужно устанавливать БД локально.
*   **Изоляция.** Каждый прогон получает свежую базу.
*   **Реальная среда.** Максимально приближено к Production (та же версия PostgreSQL).
*   **Универсальность.** Работает с Kafka, Redis, Elasticsearch и другими.

### Зависимости
```groovy
testImplementation 'org.testcontainers:junit-jupiter:1.21.4'
testImplementation 'org.testcontainers:postgresql:1.21.4'
```

### Пример использования
```java
@Testcontainers // Расширение JUnit 5 для управления контейнерами
@DataJpaTest
@ActiveProfiles("test")
class UserRepositoryIntegrationTest {

    @Container // Маркирует поле как управляемый ресурс
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15-alpine");

    @Autowired 
    private UserRepository userRepository;
    
    @Autowired 
    private TestEntityManager entityManager;

    // Динамическая подмена свойств подключения
    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("spring.datasource.driver-class-name", postgres::getDriverClassName);
    }
    
    // ... тесты ...
}
```

### Разбор аннотаций Testcontainers
*   `@Testcontainers` — расширение JUnit 5. Сканирует класс на наличие полей `@Container`. Запускает контейнер до тестов (`@BeforeAll`) и останавливает после (`@AfterAll`).
*   `@Container` — поле должно быть `static`, чтобы контейнер был общим для всех методов класса. Если не `static`, контейнер будет перезапускаться перед каждым тестом (медленно).
*   `@DynamicPropertySource` — метод выполняется до инициализации контекста Spring. Позволяет взять реальные данные у запущенного контейнера (случайный порт, пароль) и передать их в Spring вместо свойств из `application.yml`.

### Создание своего контейнера (расширенная конфигурация)
```java
private static final PostgreSQLContainer<?> postgres =
    new PostgreSQLContainer<>(DockerImageName.parse("postgres:15-alpine"))
    .withNetworkAliases("postgres")
    .withNetwork(Network.newNetwork())
    .withCommand("postgres", "-c", "max_connections=20000");
```
**Пояснение**: позволяет настроить сеть, алиасы и параметры запуска БД (аналогично `docker-compose`).

### Минусы стандартного подхода Testcontainers
1.  **Потеря времени.** Запуск контейнера занимает 2–5 секунд. При 50 классах тестов это 100–250 секунд только на старт/стоп.
2.  **Потребление ресурсов.** При параллельном запуске поднимаются копии БД, что может убить память (OutOfMemoryError).
3.  **Дублирование кода.** Логика запуска контейнера копируется в каждом тесте.

---

## 11. Оптимизация Testcontainers (JUnit Extension)

Для решения проблем скорости и ресурсов создаётся кастомная аннотация и Extension, который запускает контейнер **один раз** на все тесты.

### Кастомная аннотация
```java
@Retention(RUNTIME)
@ExtendWith({PostgresExtension.class}) // Подключаем наш Extension
public @interface WithPostgres { }
```

### Реализация Extension (Singleton Container)
```java
public class PostgresExtension implements BeforeAllCallback, ExtensionContext.Store.CloseableResource {
    // Сетевые настройки
    public static final Network PG_NETWORK = Network.newNetwork();
    private static final Lock LOCK = new ReentrantLock();
    private static final AtomicBoolean STARTED = new AtomicBoolean(false);
    
    // Статический контейнер (один на все тесты)
    private static final PostgreSQLContainer<?> POSTGRES =
        new PostgreSQLContainer<>(DockerImageName.parse("postgres:15-alpine"))
        .withNetworkAliases("postgres")
        .withNetwork(PG_NETWORK)
        .withCommand("postgres", "-c", "max_connections=20000");

    @Override
    public void beforeAll(ExtensionContext context) {
        LOCK.lock();
        try {
            // Запускаем, только если ещё не запущен (CompareAndExchange)
            if (!STARTED.compareAndExchange(false, true)) {
                log.info("Start POSTGRES Container");
                Startables.deepStart(POSTGRES).join();
                // Установка системных свойств для Spring
                System.setProperty("spring.datasource.url", POSTGRES.getJdbcUrl());
                System.setProperty("spring.datasource.username", POSTGRES.getUsername());
                System.setProperty("spring.datasource.password", POSTGRES.getPassword());
                System.setProperty("spring.datasource.driver-class-name", POSTGRES.getDriverClassName());
                
                // Регистрация ресурса для закрытия
                context.getRoot().getStore(GLOBAL).put("POSTGRES Container", this);
            }
        } finally {
            LOCK.unlock();
        }
    }

    @Override
    public void close() {
        log.info("Close POSTGRES Container");
        POSTGRES.close();
        STARTED.set(false);
    }
}
```

### Преимущества подхода с Extension
1.  **Максимальная скорость в CI/CD.** Контейнер стартует 1 раз за весь пайплайн.
2.  **Гарантированная очистка (No Leaks).** Интерфейс `CloseableResource` гарантирует уничтожение контейнера после всех тестов.
3.  **Эмуляция микросервисной сети.** Другие сервисы могут подключаться по имени (`jdbc:postgresql://postgres:...`).
4.  **Экономия ресурсов.** Исключает риск OutOfMemoryError при параллельном запуске.

---

## 12. E2E-тестирование (End-to-End)

**E2E-тесты** проверяют работу всей системы «от начала до конца», имитируя реальные сценарии пользователя.
**Цель**: убедиться, что ключевые сценарии (регистрация, оплата) работают в сборке целиком.

### Кастомная аннотация для E2E
```java
@Retention(RUNTIME)
@AutoConfigureTestEntityManager
@SpringBootTest(webEnvironment = RANDOM_PORT) // Поднимаем реальный сервер на случайном порту
@ActiveProfiles({"test", "sql-logging"})
@WithPostgres // Используем наш оптимизированный контейнер
public @interface E2ETest {
    @AliasFor(annotation = SpringBootTest.class, attribute = "properties")
    String[] properties() default {};
}
```
**Пояснение**: объединяет загрузку полного контекста, реального сервера и реальной БД.

### Пример E2E-теста
```java
@E2ETest(properties = { "any.property= example_value" })
@AutoConfigureMockMvc
public class UserControllerE2ETest {

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private ObjectMapper objectMapper;

    @Test
    void shouldCreateUserAndPersistInDatabase() throws Exception {
        // given
        User inputUser = new User();
        inputUser.setUsername("e2e_test_user");
        inputUser.setEmail("e2e@test.com");
        
        // when + then (цепочка проверок)
        final String responseJson = mockMvc.perform(post("/api/v1/users")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(inputUser)))
            .andExpect(status().isCreated()) // Статус 201
            .andExpect(jsonPath("$.id").exists()) // ID сгенерирован
            .andExpect(jsonPath("$.username").value("e2e_test_user"))
            .andReturn()
            .getResponse()
            .getContentAsString();
            
        User createdUser = objectMapper.readValue(responseJson, User.class);
        
        // Проверка в БД (интеграционная часть)
        Optional<User> userFromDb = userRepository.findById(createdUser.getId());
        assertThat(userFromDb)
            .as("Пользователь должен физически существовать в базе данных PostgreSQL")
            .isPresent();
        assertThat(userFromDb.get().getEmail()).isEqualTo("e2e@test.com");
        assertThat(userFromDb.get().getId()).isGreaterThan(0L);
    }
}
```
**Пояснение**: тест проходит через весь стек: HTTP-запрос → контроллер → сервис → реальная БД (Postgres в контейнере) → проверка ответа и состояния БД.

---

## 13. Выводы и Best Practices (Spring Data JPA)

В завершение лекции были рассмотрены ключевые аспекты работы с данными в Spring, важные для тестирования и разработки.

1.  **Способы добавления функционала в репозитории**
    *   Автоматическая генерация через naming convention (например, `findByEmail`).
    *   Аннотация `@Query` (JPQL или нативный SQL).
    *   Расширение репозитория новым интерфейсом (Custom Repository).

2.  **Кеширование в JPA**
    *   **L1 Cache** — обязательный, на уровне транзакции (`EntityManager`). Гарантирует, что в рамках одной транзакции объект загружается из БД один раз.
    *   **L2 Cache** — опциональный, на уровне приложения (`EntityManagerFactory`). Требует настройки (например, Hibernate Ehcache).

3.  **Проблема N+1**
    *   Возникает, когда при загрузке коллекции сущностей делается дополнительный запрос для каждой сущности.
    *   **Решения**: `JOIN FETCH` в JPQL, настройка `@BatchSize`, использование `EntityGraph`.

4.  **Работа с данными**
    *   Хорошей практикой является работа через пагинацию (`Pageable`) с сортировкой, чтобы не загружать лишние данные в память.

---

## 14. Итоговое резюме по тестированию

1.  **Соблюдай пирамиду.** Много быстрых юнит-тестов, меньше интеграционных, минимум E2E.
2.  **Изолируй тесты.** Используй транзакции с откатом или отдельные контейнеры.
3.  **Выбирай школу.** Для бизнес-логики чаще подходит детройтская (проверка состояния), для сложных взаимодействий — лондонская (моки).
4.  **Используй Testcontainers.** Для интеграционных тестов предпочтительнее реальная БД в контейнере, чем H2, чтобы избежать расхождений диалектов SQL.
5.  **Оптимизируй запуск.** Используй Singleton-контейнеры через JUnit Extensions для ускорения CI/CD.
6.  **Следи за контекстом.** Понимай, что грузит `@SpringBootTest`, `@WebMvcTest`, `@DataJpaTest`, чтобы тесты были быстрыми и изолированными.
