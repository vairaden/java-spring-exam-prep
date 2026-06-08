---
title: "Лонгрид 3. Стереотипные аннотации и конфигурирование"
description: "@Component, скоупы, java-/annotation-/xml-конфигурация"
---

## 1. Введение в управление компонентами Spring

Spring Framework реализует принцип инверсии управления (IoC), при котором создание и связывание объектов делегируется контейнеру. Для описания компонентов приложения используются стереотипные аннотации, которые маркируют классы в соответствии с их ролью в архитектуре. Параллельно механизмы конфигурирования позволяют настраивать поведение приложения без изменения кода.

Эти два аспекта — декларативное описание компонентов и их конфигурация — образуют фундамент для построения модульных, тестируемых и легко сопровождаемых enterprise-приложений.

## 2. Слоистая архитектура как основа enterprise-приложений

Современные приложения следуют принципу разделения ответственности, реализуя трёхуровневую архитектуру:

- **уровень представления** (Controllers) — обработка HTTP-запросов;
- **уровень бизнес-логики** (Services) — реализация правил предметной области;
- **уровень доступа к данным** (Repositories) — работа с хранилищами данных.

Spring предоставляет аннотации для каждого из этих слоев, что способствует соблюдению архитектурных границ и улучшает читаемость кода.

В контексте Spring Framework эта архитектура реализуется следующим образом.

```java
// Пример структуры пакетов для приложения управления пользователями
src/main/java/com/example/userapp/
├── UserApplication.java              // Главный класс приложения
├── config/                           // Конфигурационные классы
├── controllers/                      // Уровень представления
│   └── UserController.java
├── services/                         // Уровень бизнес-логики  
│   └── UserService.java
├── repositories/                     // Уровень доступа к данным
│   └── UserRepository.java
├── entities/                         // Сущности предметной области
│   └── User.java
└── dtos/                             // Транспортные объекты
    └── UserDto.java
```

Стереотипные аннотации непосредственно отражают эту архитектурную модель, предоставляя средства для маркировки классов в соответствии с их ролью в системе.

## 3. Стереотипные аннотации Spring

### 3.1. @Component — базовая аннотация

`@Component` — фундаментальная аннотация, указывающая, что класс является компонентом Spring. При сканировании классов Spring создаёт экземпляры таких классов и управляет их жизненным циклом.

```java
@Component
public class UserValidator {
    public boolean isValid(User user) {
        return user.getEmail() != null && user.getEmail().contains("@");
    }
}
```

### 3.2. Специализированные производные аннотации

#### @Repository — аннотация для работы с хранилищами
```java
@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
}
```

Ключевая особенность `@Repository` — автоматическая трансляция исключений доступа к данным в исключения Spring DataAccessException.

#### @Service — аннотация для обозначения слоёв с бизнес-логикой
```java
@Service
@Transactional
public class UserService {
    private final UserRepository userRepository;
    
    @Autowired
    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }
    
    public User registerUser(User user) {
        // Бизнес-логика регистрации
        return userRepository.save(user);
    }
}
```

Особенность — по факту ничем не отличается от аннотации @Component, но всё-таки рекомендуется ставить @Service для обозначения сервисного слоя.

####  @Controller — обработка HTTP-запросов

@Controller — изначально предназначался для обработки HTTP-запросов для отрисовки UI (презентационный view-слой).

```java
@Controller
@RequestMapping("/users")
public class UserController {
    
    @GetMapping("/list")
    public String listUsers(Model model) {
        model.addAttribute("users", userService.findAll());
        return "users/list";  // Имя представления
    }
    
    @PostMapping("/save")
    public String saveUser(@ModelAttribute User user) {
        userService.save(user);
        return "redirect:/users/list";
    }
}
```

Ключевая особенность — возвращает имена представлений для рендеринга.

####  @RestController — обработка запросов HTTP API

```java
@RestController
@RequestMapping("/api/users")
public class UserController {
    private final UserService userService;
    
    @GetMapping("/{id}")
    public ResponseEntity<User> getUser(@PathVariable Long id) {
        return userService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
```

`@RestController` автоматически добавляет `@ResponseBody` ко всем методам, что делает её идеальной для REST API.
`@ResponseBody` в Spring — это аннотация, указывающая, что возвращаемый методом контроллера Java-объект (POJO, список, строка) должен быть сериализован непосредственно в тело HTTP-ответа, а не интерпретирован как имя представления (шаблона). Она автоматически преобразует данные в JSON или XML с помощью HttpMessageConverter, что делает её основной для создания RESTful API.

### 3.3. Механизм сканирования компонентов

Spring автоматически обнаруживает классы с стереотипными аннотациями через `@ComponentScan`. По умолчанию сканируется пакет главного класса и все его подпакеты.

```java
@SpringBootApplication  // Содержит @ComponentScan
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
```

Явная настройка сканирования:
```java
@Configuration
@ComponentScan(
    basePackages = "com.example.user",
    excludeFilters = @ComponentScan.Filter(type = ANNOTATION, 
                    classes = Repository.class)
)
public class AppConfig { }
```

## 4. Конфигурирование приложений Spring

### 4.1. Файлы конфигурации: properties и yaml

Spring Boot поддерживает два формата конфигурационных файлов: `.properties` и `.yml`.

**application.properties**
```properties
server.port=8080
spring.datasource.url=jdbc:mysql://localhost/userdb
app.user.default-role=USER
```

**application.yml**
```yaml
server:
  port: 8080
spring:
  datasource:
    url: jdbc:mysql://localhost/userdb
app:
  user:
    default-role: USER
```

YAML обеспечивает лучшее представление иерархических данных и списков.

### 4.2. Инъекция значений с помощью @Value

Аннотация `@Value` позволяет внедрять значения из конфигурации напрямую в поля бинов.

```java
@Service
public class UserConfigService {

    // Простое значение
    @Value("${app.user.default-role}")
    private String defaultRole;

    // Со значением по умолчанию
    @Value("${app.user.session.timeout:3600}")
    private Integer sessionTimeout;

    // Выражение SpEL
    @Value("#{systemProperties['java.version']}")
    private String javaVersion;

    // Массив из строки
    @Value("${app.user.roles.allowed}")
    private String[] allowedRoles;
}
```

### 4.3. Типобезопасная конфигурация с @ConfigurationProperties

Для сложных конфигураций рекомендуется использовать `@ConfigurationProperties`, который обеспечивает типобезопасность и валидацию.

```java
@Component
@Validated
@ConfigurationProperties(prefix = "app.user")
public class UserProperties {
    
    @NotBlank
    private String defaultRole = "USER";
    
    @Min(6)
    @Max(100)
    private Integer passwordMinLength = 8;
    
    private boolean emailVerificationRequired = true;
    
    private List<String> allowedDomains = new ArrayList<>();
}
```

Использование в сервисе:
```java
@Service
public class UserRegistrationService {
    private final UserProperties userProperties;
    
    @Autowired
    public UserRegistrationService(UserProperties userProperties) {
        this.userProperties = userProperties;
    }
    
    public void validateUser(User user) {
        if (user.getPassword().length() < 
            userProperties.getPasswordMinLength()) {
            throw new ValidationException("Password too short");
        }
    }
}
```

## 5. Продвинутые механизмы конфигурирования

### 5.1. Конфигурационные классы с @Configuration

Классы, помеченные `@Configuration`, содержат методы, аннотированные `@Bean`, которые определяют бины Spring.

```java
@Configuration
public class UserConfig {
    
    @Bean
    public UserValidator userValidator() {
        return new UserValidator();
    }
    
    @Bean
    @Profile("dev")  // Создаётся только для профиля dev
    public UserRepository mockUserRepository() {
        return new InMemoryUserRepository();
    }
    
    @Bean
    @Profile("prod")
    public UserRepository jdbcUserRepository(DataSource dataSource) {
        return new JdbcUserRepository(dataSource);
    }
}
```

### 5.2. @Import — импорт конфигурационных классов

Аннотация позволяет импортировать определения из других конфигурационных классов в текущий конфигурационный класс. Это особенно полезно при модульной организации конфигурации.

#### Импорт конфигураций из сторонних библиотек
```java
@Configuration
@Import({
    JacksonAutoConfiguration.class,    
    JpaRepositoriesAutoConfiguration.class,
    SecurityAutoConfiguration.class
})
public class MyAppConfig {
    // Импорт автоконфигураций Spring Boot
}
```

### 5.3. @DependsOn — управление порядком создания бинов

По умолчанию Spring создаёт бины в произвольном порядке, но иногда требуется гарантировать определённую последовательность. Аннотация `@DependsOn` явно указывает зависимости между бинами.

#### Базовое использование
```java
@Configuration
public class InitializationConfig {
    
    @Bean
    @DependsOn("databaseInitializer")
    public UserService userService() {
        // Этот бин будет создан только после databaseInitializer
        return new UserServiceImpl();
    }
    
    @Bean
    public DatabaseInitializer databaseInitializer() {
        return new DatabaseInitializer();
    }
    
    @Bean
    @DependsOn({"databaseInitializer", "cacheManager"})
    public ReportService reportService() {
        // Зависит от двух бинов
        return new ReportServiceImpl();
    }
}
```

#### Зависимости для ленивых бинов
```java
@Configuration
public class LazyConfig {
    
    @Bean
    @Lazy
    @DependsOn("heavyResourceInitializer")
    public ExpensiveService expensiveService() {
        // Создаётся лениво, но после heavyResourceInitializer
        return new ExpensiveServiceImpl();
    }
    
    @Bean
    public HeavyResourceInitializer heavyResourceInitializer() {
        // Создаётся при старте приложения
        return new HeavyResourceInitializer();
    }
}
```

### 5.4. @PropertySource — работа с внешними файлами свойств

Аннотация `@PropertySource` позволяет загружать свойства из внешних файлов в Environment Spring. Поддерживаются форматы `.properties` и `.yml`.

#### Базовое использование
```java
@Configuration
@PropertySource("classpath:application.properties")
@PropertySource("classpath:database.properties")
public class AppConfig {
    
    @Autowired
    private Environment env;
    
    @Bean
    public DataSource dataSource() {
        String url = env.getProperty("database.url");
        String username = env.getProperty("database.username");
        String password = env.getProperty("database.password");
        
        return DataSourceBuilder.create()
            .url(url)
            .username(username)
            .password(password)
            .build();
    }
}
```

### 5.5. Управление профилями

Профили позволяют создавать различные конфигурации для разных сред выполнения.

Активация профилей:
```bash
# Через переменную среды
export SPRING_PROFILES_ACTIVE=dev,debug

# Через аргумент JVM
java -jar app.jar -Dspring.profiles.active=prod
```

В коде приложения:
```java
@Configuration
@Profile("dev")
public class DevConfig {
    @Bean
    public DataSource dataSource() {
        // In-memory-база для разработки
        return new EmbeddedDatabaseBuilder()
                .setType(EmbeddedDatabaseType.H2)
                .build();
    }
}

@Configuration
@Profile("prod")
public class ProdConfig {

    private DatabaseConfig databaseConfig;

    @Bean
    public DataSource dataSource() {
        // Продовая база данных
        return DataSourceBuilder.create()
                .url(databaseConfig.getUrl())
                .username(databaseConfig.getUsername())
                .password(databaseConfig.getPassword())
                .build();
    }
}
```

# Аннотация @Order в Spring

## Краткое определение

`@Order` определяет порядок выполнения или регистрации компонентов Spring. Это аналог приоритета в очереди — чем меньше значение, тем выше приоритет.

#### Базовое использование

- ### Автоконфигурации Spring Boot
```java
// Пользовательская автоконфигурация с высоким приоритетом
@Configuration
@AutoConfigureOrder(Ordered.HIGHEST_PRECEDENCE) // = 1
public class CustomAutoConfiguration {
    @Bean
    public CustomBean customBean() {
        return new CustomBean();
    }
}

// Или с использованием @Order
@Configuration
@Order(Ordered.HIGHEST_PRECEDENCE + 10) // = 11
public class AnotherAutoConfiguration {
    // ...
}
```

- ### AOP — порядок выполнения аспектов
```java
@Aspect
@Component
@Order(1)
public class LoggingAspect {
    @Before("execution(* com.example.service.*.*(..))")
    public void logBefore(JoinPoint joinPoint) {
        System.out.println("1. Логирование: " + joinPoint.getSignature().getName());
    }
}

@Aspect
@Component  
@Order(2)
public class SecurityAspect {
    @Before("execution(* com.example.service.*.*(..))")
    public void checkSecurity(JoinPoint joinPoint) {
        System.out.println("2. Проверка безопасности");
    }
}

@Aspect
@Component
@Order(3)
public class TransactionAspect {
    @Before("execution(* com.example.service.*.*(..))")
    public void startTransaction(JoinPoint joinPoint) {
        System.out.println("3. Начало транзакции");
    }
}

// Вызов метода сервиса выведет:
// 1) логирование: methodName,
// 2) проверку безопасности,  
// 3) начало транзакции.
```

- ### Обработчики исключений
```java
@RestControllerAdvice
@Order(1) // Проверяется первым
public class UserExceptionHandler {
    @ExceptionHandler(UserNotFoundException.class)
    public ResponseEntity<String> handleUserNotFound(UserNotFoundException ex) {
        return ResponseEntity.status(404).body("Пользователь не найден");
    }
}

@RestControllerAdvice  
@Order(2) // Проверяется вторым (более общий обработчик)
public class GlobalExceptionHandler {
    @ExceptionHandler(Exception.class)
    public ResponseEntity<String> handleAllExceptions(Exception ex) {
        return ResponseEntity.status(500).body("Внутренняя ошибка сервера");
    }
}
```

## 6. Области видимости бинов (Scope)

**Scope (область видимости)** определяет жизненный цикл и видимость бина в Spring-приложении. Каждый scope соответствует определённому контексту, в котором существует бин.

## Основные Scope в Spring

| Scope           | Описание                                 | Контекст использования                     |
|-----------------|------------------------------------------|--------------------------------------------|
| **Singleton**   | Один экземпляр на контейнер Spring       | По умолчанию для всех бинов                |
| **Prototype**   | Новый экземпляр при каждом запросе       | Состояние, специфичное для операции        |
| **Request**     | Один экземпляр на HTTP-запрос            | Веб-приложения, данные запроса             |
| **Session**     | Один экземпляр на HTTP-сессию            | Веб-приложения, данные пользователя        |
| **Application** | Один экземпляр на ServletContext         | Веб-приложения, глобальный кеш             |
| **Websocket**   | Один экземпляр на WebSocket-соединение   | Веб-приложения, специфичный кейс для ws'ов |


### 6.1. Singleton Scope (по умолчанию)

**Характеристики:**
- создаётся один раз при старте контекста;
- один экземпляр на весь ApplicationContext;
- все запросы получают один и тот же объект;
- **не потокобезопасный по умолчанию**.

#### Пример 6.1: UserService как singleton
```java
@Service  // По умолчанию scope="singleton"
public class UserService {
}
```

**Проблема потокобезопасности в singleton:**
```java
@Service
public class UnsafeUserService {
    private List<User> users = new ArrayList<>(); // Не потокобезопасно!
    
    public void addUser(User user) {
        // Может вызвать ConcurrentModificationException
        // при параллельных вызовах
        users.add(user);
    }
    
    // Решение: использовать потокобезопасные коллекции
    private ConcurrentHashMap<Long, User> concurrentUsers = new ConcurrentHashMap<>();
}
```

### 6.2. Prototype Scope

**Характеристики:**
- новый экземпляр при каждом запросе бина,
- spring не управляет полным жизненным циклом,
- не вызываются destroy-методы,
- подходит для stateful-бинов.

#### Пример 6.2: UserSession как prototype
```java
@Component
@Scope("prototype")
public class UserSession {
    private final String sessionId = UUID.randomUUID().toString();
    private User currentUser;
    private LocalDateTime createdAt = LocalDateTime.now();
}

@Service
public class AuthService {
    
    // ПРОБЛЕМА: prototype-бин в singleton
    @Autowired
    private UserSession userSession; 
    // При инжекции получим ОДИН экземпляр на всё время жизни AuthService!
    
    // РЕШЕНИЕ 1: использовать ApplicationContext
    @Autowired
    private ApplicationContext applicationContext;
    
    public UserSession createNewSession() {
        // Каждый вызов создаёт новый экземпляр
        return applicationContext.getBean(UserSession.class);
    }
    
    // РЕШЕНИЕ 2: использовать ObjectFactory (рекомендуется)
    @Autowired
    private ObjectFactory<UserSession> userSessionFactory;
    
    public UserSession createSessionWithFactory() {
        return userSessionFactory.getObject();
    }
    
    // РЕШЕНИЕ 3: использовать Provider (стандарт JSR-330)
    @Autowired
    private Provider<UserSession> userSessionProvider;
    
    public UserSession createSessionWithProvider() {
        return userSessionProvider.get();
    }
}
```

#### 6.3. Request Scope

Request — по аналогии с Prototype, но используется для данных одного HTTP-запроса.
По умолчанию потокобезопасен в рамках своего контекста


#### Пример 6.3: Request Scope для веб-приложений

```java
@Component
@Scope(value = "request", proxyMode = ScopedProxyMode.TARGET_CLASS)
public class RequestContext {
    private final String requestId = UUID.randomUUID().toString();
    private final LocalDateTime requestTime = LocalDateTime.now();
    private User authenticatedUser;
    private Map<String, Object> attributes = new HashMap<>();
    
    // …
}

@RestController
@Slf4j
public class UserController {
    
    @Autowired
    private RequestContext requestContext;
    
    @GetMapping("/api/users/me")
    public ResponseEntity<User> getCurrentUser(
            @RequestHeader("X-User-Id") String userId) {
        
        // RequestContext уникален для каждого HTTP-запроса
        log.info("Request ID: {}", requestContext.getRequestId());
        
        // Устанавливаем атрибуты, специфичные для этого запроса
        requestContext.setAttribute("user-agent", 
            ((ServletRequestAttributes) RequestContextHolder
                .currentRequestAttributes())
                .getRequest().getHeader("User-Agent"));
        
        User user = userService.findById(userId);
        requestContext.setAuthenticatedUser(user);
        
        return ResponseEntity.ok(user);
    }
}
```

#### Пример 6.4: Session Scope

Session — по аналогии с Prototype, но используется для данных пользовательской сессии (корзина, настройки).
Как и Request, по умолчанию потокобезопасен в рамках своего контекста.

#### Пример 6.4: Session Scope для пользовательской сессии

```java
@Component
@Scope(value = "session", proxyMode = ScopedProxyMode.TARGET_CLASS)
public class UserShoppingCart {
    private List<CartItem> items = new ArrayList<>();
    private BigDecimal totalPrice = BigDecimal.ZERO;
    private User user;
    
    public void addItem(Product product, int quantity) {
        CartItem item = new CartItem(product, quantity);
        items.add(item);
        recalculateTotal();
    }
    
    // …
}

@Controller
public class ShoppingController {
    
    @Autowired
    private UserShoppingCart shoppingCart;
    
    @PostMapping("/cart/add")
    public String addToCart(@RequestParam Long productId, 
                           @RequestParam Integer quantity) {
        Product product = productService.findById(productId);
        shoppingCart.addItem(product, quantity);
        return "redirect:/cart";
    }
}
```

#### 6.5. Application Scope

Application — бин создаётся один раз на ServletContext.
Похож на singleton, но есть отличия в контексте: singleton — на Spring ApplicationContext, а application — на ServletContext.

#### Пример 6.5: Request Scope для веб-приложений

```java
@Component
@Scope(value = "application", proxyMode = ScopedProxyMode.TARGET_CLASS)
public class ApplicationScopedBean {
    private int visitorCount = 0;

    public int getVisitorCount() {
        return ++visitorCount;
    }
}
```

#### 6.6 WebSocket Scope 

**WebSocket Scope** — это специализированная область видимости для приложений Spring WebSocket, где каждый бин привязан к жизни отдельного WebSocket-соединения.
Это аналог session scope, но для WebSocket-протокола.

**Характеристики:**

- **Жизненный цикл**: создаётся при установлении WebSocket-соединения, уничтожается при его разрыве.
- **Область применения**: веб-приложения с взаимодействием real-time (чаты, игры, уведомления).
- **Аналогия**: похож на session scope, но для WebSocket вместо HTTP.

#### Пример 6.6: Компонент WebSocket Scope для хранения состояния чата 
```java
@Component
@Scope(value = "websocket", proxyMode = ScopedProxyMode.TARGET_CLASS)
public class GameSession {
    ...
}
```

### 7. Проксирование (proxyMode) для scope, меньших, чем singleton

Для scope, которые меньше, чем singleton (например, request, session, application), при инжекции в singleton-бины необходимо использовать прокси. Иначе инжектируется один и тот же экземпляр, созданный при старте приложения.

Пример проблемы без прокси:

```java
@Service  // singleton
public class UserService {
    @Autowired
    private RequestScopedBean requestScopedBean;  // Будет один экземпляр, созданный при старте
}
```

### Использование proxyMode
Можно использовать в @Scope аннотации proxyMode = ScopedProxyMode.TARGET_CLASS (для классов) или ScopedProxyMode.INTERFACES (для интерфейсов).

### Использование ObjectFactory / ObjectProvider / Provider
Вместо прокси можно использовать ObjectFactory / ObjectProvider / Provider для ленивого получения бина.

Пример:

```java
@Service
public class UserService {
    @Autowired
    private ObjectFactory<RequestScopedBean> requestScopedBeanFactory;

    public void doSomething() {
        RequestScopedBean requestScopedBean = requestScopedBeanFactory.getObject();
        // работа с requestScopedBean
    }
}
```

1. **ObjectFactory (Spring-native)**
   Это самый старый интерфейс, появившийся в Spring 1.0.
    - Функционал: Содержит только один метод getObject().
    - Минусы: Если бин не найден или их несколько, он просто выбросит исключение (NoSuchBeanDefinitionException или NoUniqueBeanDefinitionException). Никаких проверок «на месте» сделать нельзя.
    - Когда использовать: практически никогда в современном коде; заменен на ObjectProvider.
---
2. **ObjectProvider (Рекомендовано для Spring)**
   Это современный наследник ObjectFactory, появившийся в Spring 4.3. Он является интерфейсом выбора для разработки на Spring Boot.
    - Безопасность: Позволяет избежать ошибок, если бина нет. Есть методы getIfAvailable() (вернет null, если нет бина) и getIfUnique().
    - Функциональное программирование: Поддерживает Stream API через метод stream(), что удобно для получения всех бинов определенного типа и их фильтрации.
    - Лямбды: Позволяет задать дефолтное поведение: provider.getIfAvailable(() -> new MyDefaultBean()).
---
3. **Provider (JSR-330)**
   Это стандарт Java (Java Dependency Injection), который Spring поддерживает «из коробки».
    - Функционал: Аналогичен ObjectFactory, метод называется get().
    - Плюс: Код становится независимым от Spring. Если вы захотите перенести этот класс в проект на Micronaut или Google Guice, он будет работать.
    - Минус: Ограниченная логика (только получение объекта).
---

### @Lookup

Аннотация @Lookup — это альтернативный способ решения проблемы Scoped Proxy. Она используется, когда Singleton-бину нужно каждый раз получать новый экземпляр Prototype-бина.
Вместо того чтобы внедрять ObjectProvider, вы помечаете метод аннотацией @Lookup, и Spring переопределяет этот метод динамически (через CGLIB), чтобы он возвращал актуальный бин из контекста.


Пример:

```java
@Service
public abstract class UserService {
    public void process() {
        UserSession userSession = createUserSession();
        // …
    }

    @Lookup
    protected abstract UserSession createUserSession();
}
```

## 8. Заключение

Стереотипные аннотации и механизмы конфигурирования образуют основу для построения структурированных Spring-приложений.
Аннотации `@Component`, `@Service`, `@Repository`, `@Controller` и `@RestController` обеспечивают чёткое разделение ответственности между слоями приложения.
Механизмы конфигурирования через properties-/yaml-файлы, `@Value`, `@ConfigurationProperties` и конфигурационные классы предоставляют гибкость настройки приложения для различных сред выполнения.

Правильное использование этих инструментов позволяет создавать поддерживаемые, тестируемые и легко конфигурируемые enterprise-приложения, соответствующие современным стандартам разработки.
