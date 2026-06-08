---
title: "Лонгрид 1. Введение в Spring Framework"
description: "Что такое фреймворк, IoC/DI, ядро Spring и Spring Boot"
---

## Содержание
1. [Что такое фреймворк и чем отличается от библиотеки](#1)
2. [Что такое Spring Framework?](#2)
3. [Проблемы, которые решает Spring и Spring Boot](#3)
4. [Проблема отсутствия DI](#4)
5. [Inversion of Control (IoC)](#5)
6. [Dependency Injection (DI)](#6)
7. [Понятие контекста. ApplicationContext](#7)
8. [Понятие бина](#8)
9. [Аннотации: @Component, @Autowired, @Qualifier, @Primary](#9)
10. [Просмотр бинов в дебаггере](#10)
11. [Инструменты для просмотра бинов](#11)
12. [FAQ](#12)

---

# <a name="1"></a>1. Что такое фреймворк и чем отличается от библиотеки

## Концептуальное различие

**Библиотека** — это набор готовых функций, классов и методов, которые вы вызываете в своем коде для решения конкретных задач. Вы контролируете поток выполнения, а библиотека предоставляет инструменты.

**Фреймворк** — это скелет приложения, который определяет архитектуру и поток управления. Здесь уже фреймворк контролирует выполнение, а ваш код заполняет определенные места (точки расширения).

## Аналогия из реальной жизни

**Библиотека** — как набор инструментов в ящике. Вы строите дом и берете молоток, когда нужно забить гвоздь. Вы решаете, когда и какой инструмент использовать.

**Фреймворк** — как готовый каркас дома с заранее определенными местами для окон, дверей, коммуникаций. Вы заполняете эти места, но общая структура уже задана.

## Технический пример

### Библиотека (Apache Commons):
```java
// Вы явно вызываете методы библиотеки
StringUtils.isEmpty("text");
NumberUtils.isNumber("123");
```

### Фреймворк (Spring MVC):
```java
// Фреймворк вызывает ваш код

@Controller
public class UserController {
    @GetMapping("/users")  // Аннотация указывает фреймворку, КОГДА вызвать метод
    public String getUsers(Model model) {
        // Ваш код, который выполнится ПО ЗАПРОСУ фреймворка
        model.addAttribute("users", userService.findAll());
        return "users";
    }
}
```

## Диаграмма контроля потока:
```java
Библиотека:
Ваш код → Вызов библиотеки → Возврат управления → Ваш код продолжается

Фреймворк:
Фреймворк запускается → Ищет ваши классы → Вызывает ваши методы → Управляет жизненным циклом
```

### Ключевые отличия:

1. **Инверсия управления (IoC)**
    - Библиотека: Вы управляете вызовами
    - Фреймворк: Фреймворк управляет вашим кодом

2. **Степень связанности**
    - Библиотека: Слабая связь, можно легко заменить
    - Фреймворк: Сильная связь, замена требует переработки архитектуры

3. **Архитектурное влияние**
    - Библиотека: Не навязывает архитектуру
    - Фреймворк: Определяет архитектурные паттерны

Spring решает:
- **Архитектура:** Предоставляет шаблоны (MVC для веб), делая код модульным и testable.
- **Быстрое подключение:** Spring Boot использует starters (например, spring-boot-starter-web для веб-сервера).
- **Функция библиотеки:** Готовые модули для JDBC, REST, AOP и т. Д., без написания с нуля.
  Spring решает три ключевые проблемы:

- **Архитектура:** Без Spring код становится "спагетти" — жесткие связи, трудно тестировать. Spring навязывает модульность (например, MVC-паттерн), делая приложение scalable и maintainable.
- **Быстрое подключение необходимого:** Ручная настройка (например, Tomcat + Hibernate) занимает часы. Spring Boot использует "starters" — готовые пакеты (например, spring-boot-starter-web добавляет веб-сервер за секунды).
- **Функция библиотеки:** Spring предоставляет готовые инструменты (JDBC, REST, AOP), как библиотека, но с интеграцией в фреймворк.

### Подводные камни:
- **Вендор-лок**: Привязка к конкретному фреймворку
- **Кривая обучения**: Фреймворки требуют больше времени на освоение
- **Избыточность**: Фреймворк может включать ненужный функционал

---

# <a name="2"></a>2. Что такое Spring Framework?

## Определение

Spring Framework — это полнофункциональный, модульный фреймворк с открытым исходным кодом для построения корпоративных приложений на Java. Он предоставляет комплексную инфраструктурную поддержку для разработки Java-приложений.

## Исторический контекст

**2002 год**: Род Джонсон публикует книгу "Expert One-on-One J2EE Design and Development", где критикует сложность EJB (Enterprise Java Beans) и предлагает более легковесный подход.

**2003 год**: Первый релиз Spring Framework как альтернативы тяжеловесным J2EE-технологиям.

## Архитектурные модули Spring

```java
Spring Framework
├── Core Container (IoC, DI, Beans)
├── AOP (Aspect-Oriented Programming)
├── Data Access/Integration
│   ├── JDBC
│   ├── ORM (Hibernate, JPA)
│   ├── Transactions
├── Web
│   ├── Servlet (Spring MVC)
│   ├── WebFlux (реактивное программирование)
└── Testing
```

## Философия Spring

1. **Не изобретай велосипед** — используй лучшие практики
2. **Обратная связь с сообществом** — развивается на основе реальных потребностей
3. **Backward compatibility** — сохранение совместимости с предыдущими версиями
4. **Модульность** — используй только то, что нужно

## Пример минимального Spring-приложения:

```java
// Старый способ (до Spring Boot)
public class MainApp {
    public static void main(String[] args) {
        // 1. Создаем контекст Spring
        ApplicationContext context = new ClassPathXmlApplicationContext("applicationContext.xml");
        
        // 2. Получаем бин из контекста
        UserService userService = context.getBean(UserService.class);
        
        // 3. Используем бин
        userService.processUsers();
    }
}
```

## Почему Spring стал стандартом де-факто?

1. **Упрощение разработки** через DI и IoC
2. **Модульность** — можно использовать частично
3. **Интеграция** с другими технологиями (Hibernate, Kafka, Redis)
4. **Активное сообщество** и постоянное развитие
5. **Документация** — одна из лучших в Java-экосистеме

---

# <a name="3"></a>3. Проблемы, которые решает Spring и Spring Boot

## Проблемы "до Spring"

### 1. Сложность EJB (Enterprise Java Beans)
```java
// EJB 2.x - ужасная сложность
public class UserBean implements EntityBean {
    private EntityContext context;
    
    public void setEntityContext(EntityContext ctx) {
        this.context = ctx;
    }
    
    // Десятки обязательных методов...
    // XML-дескрипторы на сотни строк
}
```

### 2. Жесткая связность (Tight Coupling)
```java
// Проблема: классы тесно связаны
public class UserService {
    private UserRepository repository = new UserRepositoryImpl();
    // Невозможно заменить реализацию без изменения кода
}

public class OrderService {
    private UserRepository repository = new UserRepositoryImpl();
    // Дублирование создания объектов
}
```

### 3. Управление транзакциями вручную
```java
public void transferMoney(Account from, Account to, BigDecimal amount) {
    Connection conn = null;
    try {
        conn = dataSource.getConnection();
        conn.setAutoCommit(false);  // Ручное управление
        
        // Бизнес-логика
        withdraw(from, amount, conn);
        deposit(to, amount, conn);
        
        conn.commit();  // Ручной коммит
    } catch (SQLException e) {
        if (conn != null) conn.rollback();  // Ручной откат
        throw new RuntimeException(e);
    } finally {
        if (conn != null) conn.close();  // Ручное закрытие
    }
}
```

## Как Spring решает эти проблемы?

### 1. Легковесность через POJO
```java
// Простой Java-класс (POJO) становится Spring-бином
@Component
public class UserService {
    @Autowired
    private UserRepository repository;
    // Никаких интерфейсов EJB, только аннотации
}
```

### 2. Внедрение зависимостей
```java
@Configuration
public class AppConfig {
    @Bean
    public UserRepository userRepository() {
        return new UserRepositoryImpl();
    }
    
    @Bean
    public UserService userService(UserRepository repo) {
        return new UserService(repo);  // Spring сам внедрит зависимость
    }
}
```

### 3. Декларативное управление транзакциями
```java
@Service
@Transactional  // Всего одна аннотация!
public class BankingService {
    public void transferMoney(Account from, Account to, BigDecimal amount) {
        // Чистая бизнес-логика
        withdraw(from, amount);
        deposit(to, amount);
        // Spring сам управляет транзакцией
    }
}
```

## Проблемы, которые решает Spring Boot

### 1. Конфигурационная адская работа (Configuration Hell)
**До Spring Boot:**
```xml
<!-- web.xml -->
<servlet>
    <servlet-name>dispatcher</servlet-name>
    <servlet-class>org.springframework.web.servlet.DispatcherServlet</servlet-class>
    <init-param>
        <param-name>contextConfigLocation</param-name>
        <param-value>/WEB-INF/applicationContext.xml</param-value>
    </init-param>
    <load-on-startup>1</load-on-startup>
</servlet>

<!-- applicationContext.xml -->
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:context="http://www.springframework.org/schema/context"
       xmlns:mvc="http://www.springframework.org/schema/mvc"
       xsi:schemaLocation="...">
    
    <context:component-scan base-package="com.example"/>
    <mvc:annotation-driven/>
    <!-- Еще 50 строк конфигурации -->
</beans>
```

**После Spring Boot:**
```java
@SpringBootApplication  // Всего одна аннотация!
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
```

### 2. Автоконфигурация (Auto-configuration)
Spring Boot анализирует classpath и автоматически настраивает бины:
- Видит H2 в classpath → настраивает in-memory БД
- Видит Tomcat → запускает встроенный сервер
- Видит Thymeleaf → настраивает шаблонизатор

### 3. Starter-зависимости
```xml
<!-- Вместо 10 отдельных зависимостей -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
</dependency>
<!-- Включает: Tomcat, Spring MVC, Jackson, Validation, и т.д. -->
```

## Диаграмма эволюции:
```java
До Spring:          EJB + Servlets + JSP + ручная конфигурация
                    ↓
Spring Framework:   POJO + DI + модульность + XML конфигурация
                    ↓
Spring Boot:        Автоконфигурация + Starter + Embedded Server
```

## Подводные камни Spring Boot:
1. **Магия автоконфигурации** — сложно понять, что происходит "под капотом"
2. **Избыточные зависимости** — могут подтянуться ненужные библиотеки
3. **Сложность кастомизации** — переопределение автоконфигурации требует глубоких знаний

---

# <a name="4"></a>4. Проблема отсутствия DI

## Что такое Dependency Injection (DI)?

**Внедрение зависимостей** — это паттерн проектирования, при котором зависимости объекта предоставляются извне, а не создаются внутри объекта.

Без Dependency Injection (DI) вы вручную создаете объекты: `Service service = new Service();`. Это приводит к жестким зависимостям, сложностям в тестировании (нельзя подменить mock) и дублированию кода.
Dependency Injection (DI) — это паттерн для управления зависимостями. Без DI вы создаете объекты вручную: это приводит к жестким связям (tight coupling), сложностям в тестировании (нельзя легко подменить на mock) и дублированию кода. Изменение одного класса требует правок везде, приложение становится хрупким.

## Проблема: жесткая связность (Tight Coupling)

```java
// ПЛОХО: жесткая связность
public class EmailService {
    private SmtpSender sender = new SmtpSender("smtp.gmail.com", 587);
    // Класс EmailService жестко привязан к SmtpSender
}

public class NotificationService {
    private EmailService emailService = new EmailService();
    // И NotificationService жестко привязан к EmailService
}
```

**Проблемы такого подхода:**
1. **Невозможность тестирования**
```java
@Test
void testNotification() {
    NotificationService service = new NotificationService();
    // Опа! Отправляются реальные письма на продакшн!
    // Невозможно подменить EmailService моком
}
```

2. **Сложность замены реализации**
```java
// Хотим использовать SendGrid вместо SMTP?
// Придется переписывать все классы, где используется EmailService
public class EmailService {
    private SendGridSender sender = new SendGridSender("api-key");
    // Изменение в одном месте → изменения во многих местах
}
```

3. **Нарушение Single Responsibility Principle**
```java
public class UserService {
    private UserRepository repository = new JdbcUserRepository();
    private EmailService emailService = new EmailService();
    private Validator validator = new UserValidator();
    
    // Класс занимается созданием объектов, а не только бизнес-логикой
}
```

4. **Проблемы с жизненным циклом**
```java
public class DatabaseConnection {
    private static DatabaseConnection instance;
    
    public static DatabaseConnection getInstance() {
        if (instance == null) {
            instance = new DatabaseConnection();  // Singleton антипаттерн
        }
        return instance;
    }
}
// Кто будет закрывать соединение? Когда?
```

## Решение через Dependency Injection

```java
// ХОРОШО: зависимости внедряются извне
public class EmailService {
    private final EmailSender sender;
    
    // Зависимость передается через конструктор
    public EmailService(EmailSender sender) {
        this.sender = sender;
    }
}

public class NotificationService {
    private final EmailService emailService;
    
    public NotificationService(EmailService emailService) {
        this.emailService = emailService;
    }
}

// Теперь можем легко тестировать и менять реализации
@Test
void testNotification() {
    EmailSender mockSender = mock(EmailSender.class);
    EmailService emailService = new EmailService(mockSender);
    NotificationService service = new NotificationService(emailService);
    
    // Тестируем без реальной отправки писем
}
```

---

# <a name="5"></a>5. Inversion of Control (IoC)

## Концепция IoC

**Inversion of Control (Инверсия управления)** — это принцип, при котором управление созданием объектов и вызовом методов передается от программиста к фреймворку или контейнеру.
IoC — "инверсия контроля": фреймворк управляет созданием и жизненным циклом объектов, а не ваш код. Spring реализует IoC через контейнер.
IoC — принцип, где контроль над созданием и управлением объектами передается контейнеру (фреймворку), а не вашему коду. Вместо `new Object()` фреймворк создает и связывает всё сам. Это упрощает код и повышает гибкость.
## Традиционный подход (без IoC)

```java
public class TraditionalApp {
    public static void main(String[] args) {
        // Программист полностью контролирует создание объектов
        DatabaseConfig config = new DatabaseConfig("localhost", 5432);
        ConnectionFactory factory = new ConnectionFactory(config);
        UserRepository repository = new UserRepository(factory);
        UserService service = new UserService(repository);
        
        // И их вызов
        service.processUsers();
    }
}
```

**Проблема:** Программист должен знать весь граф зависимостей и порядок создания.

## Подход с IoC

```java
@Configuration
public class AppConfig {
    @Bean
    public DatabaseConfig databaseConfig() {
        return new DatabaseConfig("localhost", 5432);
    }
    
    @Bean
    public ConnectionFactory connectionFactory(DatabaseConfig config) {
        return new ConnectionFactory(config);
    }
    
    @Bean
    public UserRepository userRepository(ConnectionFactory factory) {
        return new UserRepository(factory);
    }
    
    @Bean
    public UserService userService(UserRepository repository) {
        return new UserService(repository);
    }
}

public class IoCApp {
    public static void main(String[] args) {
        // Spring создает все объекты и управляет ими
        ApplicationContext context = new AnnotationConfigApplicationContext(AppConfig.class);
        UserService service = context.getBean(UserService.class);
        service.processUsers();
    }
}
```

## Как работает IoC контейнер?

1. **Сканирование конфигурации**
2. **Создание графа зависимостей**
3. **Создание бинов в правильном порядке**
4. **Внедрение зависимостей**
5. **Управление жизненным циклом**

### Диаграмма IoC:

```java
Без IoC:
Main → создает A → создает B → создает C → вызывает методы

С IoC:
IoC Container → создает C → создает B → создает A → Main запрашивает A
```

## Преимущества IoC:

1. **Слабая связность** — классы не знают о создании зависимостей
2. **Централизованная конфигурация** — все зависимости в одном месте
3. **Упрощение тестирования** — легко подменять реализации
4. **Управление жизненным циклом** — контейнер управляет созданием и уничтожением

## Реализации IoC в Spring:

1. **BeanFactory** — базовая реализация
2. **ApplicationContext** — расширенная версия с дополнительными функциями
3. **AnnotationConfigApplicationContext** — для Java-based конфигурации
4. **ClassPathXmlApplicationContext** — для XML конфигурации

# <a name="6"></a>6. Dependency Injection (DI): field, constructor, setter

## Три способа внедрения зависимостей

### 1. Field Injection (Внедрение в поле)

```java
@Component
public class UserService {
    @Autowired  // Аннотация прямо над полем
    private UserRepository userRepository;
    
    @Autowired
    @Qualifier("emailNotification")
    private NotificationService notificationService;
}
```

**Преимущества:**
- Минимальный boilerplate-код
- Простота чтения

**Недостатки:**
- **Нарушение инкапсуляции** — поля должны быть private, но Spring использует reflection
- **Сложность тестирования** — нужен Spring контекст или Mockito
- **Невозможность сделать поле final**
- **Циклические зависимости** сложнее обнаружить

**Тестирование Field Injection:**
```java
@Test
void testWithSpring() {
    // Требуется Spring контекст
    ApplicationContext context = ...;
    UserService service = context.getBean(UserService.class);
}

@Test
void testWithReflection() {
    UserService service = new UserService();
    // Ужасный код с reflection
    Field field = UserService.class.getDeclaredField("userRepository");
    field.setAccessible(true);
    field.set(service, mock(UserRepository.class));
}
```

### 2. Setter Injection (Внедрение через сеттер)

```java
@Component
public class UserService {
    private UserRepository userRepository;
    private NotificationService notificationService;
    
    @Autowired  // На сеттере
    public void setUserRepository(UserRepository userRepository) {
        this.userRepository = userRepository;
    }
    
    @Autowired
    @Qualifier("smsNotification")
    public void setNotificationService(NotificationService notificationService) {
        this.notificationService = notificationService;
    }
    
    // Можно сделать optional dependency
    @Autowired(required = false)
    public void setOptionalService(OptionalService optionalService) {
        this.optionalService = optionalService;
    }
}
```

**Преимущества:**
- **Гибкость** — зависимости можно менять после создания объекта
- **Optional зависимости** — через required = false
- **Более тестируемо** чем field injection

**Недостатки:**
- Объект может быть в невалидном состоянии между созданием и вызовом сеттера
- **Mutable объекты** — зависимости можно изменить в runtime

**Тестирование Setter Injection:**
```java
@Test
void testSetterInjection() {
    UserService service = new UserService();
    service.setUserRepository(mock(UserRepository.class));
    // Объект готов к использованию
}
```

### 3. Constructor Injection (Внедрение через конструктор)

```java
@Component
public class UserService {
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    
    // Один конструктор - @Autowired не обязателен (с Spring 4.3+)
    public UserService(UserRepository userRepository, 
                      NotificationService notificationService) {
        this.userRepository = userRepository;
        this.notificationService = notificationService;
    }
    
    // Или с @Autowired для ясности
    @Autowired
    public UserService(UserRepository userRepository,
                      @Qualifier("pushNotification") NotificationService notificationService) {
        this.userRepository = userRepository;
        this.notificationService = notificationService;
    }
}
```

**Преимущества:**
- **Неизменяемость (Immutability)** — поля можно сделать final
- **Гарантированная инициализация** — объект всегда в валидном состоянии
- **Явные зависимости** — видно все зависимости класса
- **Лучшая тестируемость**
- **Обнаружение циклических зависимостей** на этапе создания контекста

**Недостатки:**
- Больше boilerplate-кода
- Много параметров в конструкторе (признак нарушения SRP)

**Тестирование Constructor Injection:**
```java
@Test
void testConstructorInjection() {
    UserRepository repo = mock(UserRepository.class);
    NotificationService notif = mock(NotificationService.class);
    
    UserService service = new UserService(repo, notif);
    // Чистый unit-тест без Spring
}
```

## Сравнение способов DI:

| Критерий | Field | Setter | Constructor |
|----------|-------|--------|-------------|
| Неизменяемость | ❌ Нет | ❌ Нет | ✅ Да |
| Тестируемость | ❌ Плохая | ✅ Хорошая | ✅ Отличная |
| Boilerplate | ✅ Минимум | ⚠️ Средне | ❌ Много |
| Валидность состояния | ⚠️ После @PostConstruct | ❌ Не гарантирована | ✅ Гарантирована |
| Optional зависимости | ❌ Нет | ✅ Да | ⚠️ Через @Nullable |
| Циклические зависимости | ❌ Сложно обнаружить | ❌ Сложно обнаружить | ✅ Обнаруживаются сразу |

## Рекомендации Spring Team:

**Используйте Constructor Injection для mandatory dependencies!**

```java
@Component
public class BestPracticeService {
    // Обязательные зависимости - через конструктор
    private final UserRepository userRepository;
    private final EmailService emailService;
    
    public BestPracticeService (UserRepository userRepository, 
                              EmailService emailService) {
        this.userRepository = userRepository;
        this.emailService = emailService;
    }
    
    // Optional зависимости - через setter
    private CacheService cacheService;
    
    @Autowired (required = false)
    public void setCacheService (CacheService cacheService) {
        this.cacheService = cacheService;
    }
    
    // Lombok может помочь с boilerplate
    @RequiredArgsConstructor
    @Component
    public static class LombokExample {
        private final @NonNull UserRepository userRepository;
        @Autowired (required = false)
        private CacheService cacheService;
    }
}
```

### Особые случаи:

#### 1. Циклические зависимости
```java
// ПРОБЛЕМА: A зависит от B, B зависит от A
@Component
class ServiceA {
    @Autowired
    private ServiceB serviceB;  // Цикл!
}

@Component
class ServiceB {
    @Autowired
    private ServiceA serviceA;  // Цикл!
}

// РЕШЕНИЕ 1: Использовать setter injection для одного из бинов
@Component
class ServiceA {
    private ServiceB serviceB;
    
    @Autowired
    public void setServiceB (ServiceB serviceB) {
        this.serviceB = serviceB;
    }
}

// РЕШЕНИЕ 2: @Lazy - отложенная инициализация
@Component
class ServiceA {
    @Lazy
    @Autowired
    private ServiceB serviceB;
}

// РЕШЕНИЕ 3: Перепроектировать архитектуру (лучший вариант)
```

#### 2. Коллекции зависимостей
```java
@Component
public class NotificationDispatcher {
    // Spring внедрит ВСЕ бины типа NotificationService
    @Autowired
    private List<NotificationService> allNotificationServices;
    
    // Или с квалификатором
    @Autowired
    @Qualifier ("email")
    private NotificationService emailService;
    
    // Или Map с именами бинов как ключи
    @Autowired
    private Map<String, NotificationService> servicesMap;
}
```

---

# <a name="7"></a>7. Понятие контекста. ApplicationContext

## Что такое ApplicationContext?

**ApplicationContext** — это центральный интерфейс в Spring, который представляет IoC-контейнер и отвечает за:
- Создание и управление бинами
- Внедрение зависимостей
- Управление жизненным циклом
- Публикация событий
- Доступ к ресурсам
- Интернационализация (i18n)

## Иерархия контекстов:

```java
BeanFactory (базовый интерфейс)
    ↑
ApplicationContext (расширенный)
    ↑
ConfigurableApplicationContext
    ↑
AbstractApplicationContext
    ├── ClassPathXmlApplicationContext
    ├── FileSystemXmlApplicationContext
    ├── AnnotationConfigApplicationContext
    ├── GenericWebApplicationContext
    └── ...
```

## Создание контекста:

### 1. XML-based конфигурация
```java
// applicationContext. Xml в classpath
ApplicationContext context = new ClassPathXmlApplicationContext ("applicationContext. Xml");

// Или конкретный файл
ApplicationContext context = new FileSystemXmlApplicationContext ("/config/applicationContext. Xml");
```

### 2. Annotation-based конфигурация
```java
// Сканирование пакета
ApplicationContext context = new AnnotationConfigApplicationContext ("com. Example");

// Или через класс конфигурации
@Configuration
@ComponentScan ("com.example")
public class AppConfig {}

ApplicationContext context = new AnnotationConfigApplicationContext (AppConfig. class);
```

### 3. Spring Boot
```java
@SpringBootApplication
public class Application {
    public static void main (String[] args) {
        // Spring Boot создает контекст автоматически
        ApplicationContext context = SpringApplication.run(Application.class, args);
    }
}
```

## Основные методы ApplicationContext:

```java
public interface ApplicationContext extends EnvironmentCapable, ListableBeanFactory, 
                                           HierarchicalBeanFactory, MessageSource,
                                           ApplicationEventPublisher, ResourcePatternResolver {
    
    // Получение бина по типу
    <T> T getBean (class<T> requiredType) throws BeansException;
    
    // Получение бина по имени и типу
    <T> T getBean (String name, class<T> requiredType) throws BeansException;
    
    // Получение всех бинов определенного типа
    <T> Map<String, T> getBeansOfType (class<T> type) throws BeansException;
    
    // Проверка существования бина
    Boolean containsBean (String name);
    
    // Получение информации о бине
    BeanDefinition getBeanDefinition (String beanName) throws NoSuchBeanDefinitionException;
    
    // Получение родительского контекста
    ApplicationContext getParent();
    
    // Получение идентификатора контекста
    String getId();
    
    // Получение имени приложения
    String getApplicationName();
    
    // Получение времени запуска
    Long getStartupDate();
}
```

## Жизненный цикл ApplicationContext:

```java
public class ContextLifecycleExample {
    public static void main (String[] args) {
        // 1. Создание контекста
        ConfigurableApplicationContext context = 
            new AnnotationConfigApplicationContext(AppConfig.class);
        
        try {
            // 2. Контекст активен, бины готовы
            UserService service = context.getBean(UserService.class);
            service.processUsers();
            
            // 3. Публикация событий
            context.publishEvent(new CustomEvent(context));
        } finally {
            // 4. Закрытие контекста (вызовет @PreDestroy методы)
            context.close();
        }
    }
}
```

## Особенности работы контекста:

### 1. Lazy vs Eager инициализация
```java
@Component
@Lazy  // Будет создан только при первом запросе
public class LazyService {
    public LazyService() {
        System.out.println("LazyService создан!");
    }
}

@Component  // Создается при старте контекста (по умолчанию)
public class EagerService {
    public EagerService() {
        System.out.println("EagerService создан!");
    }
}
```

### 2. Scope бинов
```java
@Component
@Scope ("singleton")  // Один бин на весь контекст (по умолчанию)
public class SingletonBean {}

@Component
@Scope ("prototype")  // Новый бин при каждом запросе
public class PrototypeBean {}

@Component
@Scope (value = WebApplicationContext. SCOPE_SESSION, proxyMode = ScopedProxyMode.TARGET_CLASS)
public class SessionScopedBean {}  // Для веб-приложений
```

### 3. Parent-Child контексты
```java
// Родительский контекст
ApplicationContext parent = new AnnotationConfigApplicationContext(ParentConfig.class);

// Дочерний контекст
AnnotationConfigApplicationContext child = new AnnotationConfigApplicationContext();
    child.setParent(parent);
    child.register(ChildConfig.class);
    child.refresh();

// Дочерний контекст видит бины родительского, но не наоборот
```

## Отладка контекста:

```java
// Вывод всех бинов в контексте
ApplicationContext context = ...;
String[] beanNames = context.getBeanDefinitionNames();
Arrays.sort(beanNames);
for(String beanName : beanNames) {
    System.out.println(beanName + " : " + context.getBean(beanName).getClass().getName());
}

// Проверка конкретного бина
if (context.containsBean("userService")) {
    Object bean = context.getBean("userService");
    System.out.println("Bean class: " + bean.getClass());
}
```

---

# <a name="8"></a>8. Понятие бина. Создание бинов

## Что такое бин (Bean)?

**Бин** — это объект, который:
1. Создается и управляется Spring IoC-контейнером
2. Имеет уникальное имя (id) в контексте
3. Следует жизненному циклу, определенному контейнером
4. Может иметь зависимости, которые внедряются контейнером

## Три способа создания бинов:

### 1. Через XML конфигурацию (legacy, но все еще используется)

**applicationContext. Xml:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xsi:schemaLocation="http://www.springframework.org/schema/beans
                           http://www.springframework.org/schema/beans/spring-beans.xsd">
    
    <!-- Простой бин -->
    <bean id="userRepository" class="com.example.UserRepositoryImpl"/>
    
    <!-- Бин с зависимостью -->
    <bean id="userService" class="com.example.UserService">
        <constructor-arg ref="userRepository"/>
    </bean>
    
    <!-- Бин с property injection -->
    <bean id="notificationService" class="com.example.EmailNotificationService">
        <property name="smtpHost" value="smtp.gmail.com"/>
        <property name="smtpPort" value="587"/>
    </bean>
    
    <!-- Бин с init/destroy методами -->
    <bean id="dataSource" class="com. Example. BasicDataSource"
          Init-method="init" destroy-method="close">
        <property name="driverClassName" value="org.h2.Driver"/>
        <property name="url" value="jdbc:h2:mem:testdb"/>
    </bean>
    
    <!-- Бин со scope -->
    <bean id="shoppingCart" class="com. Example. ShoppingCart"
          Scope="session">
        <aop:scoped-proxy/>  <!-- Для инжекции в singleton -->
    </bean>
</beans>
```

**Java код для использования:**
```java
public class XmlConfigExample {
    public static void main (String[] args) {
        ApplicationContext context = 
            new ClassPathXmlApplicationContext("applicationContext.xml");
        
        UserService service = (UserService) context.getBean("userService");
        service.processUsers();
    }
}
```

**Преимущества XML:**
- Централизованная конфигурация
- Изменение без перекомпиляции
- Поддержка legacy систем

**Недостатки XML:**
- Не type-safe (ошибки обнаруживаются в runtime)
- Много boilerplate-кода
- Нет помощи IDE (автодополнение, рефакторинг)

### 2. Через аннотации (современный подход)

```java
// 1. Помечаем класс как компонент
@Component  // или @Service, @Repository, @Controller
public class UserRepositoryImpl implements UserRepository {
    // Логика репозитория
}

// 2. Сервис с зависимостью
@Service
public class UserService {
    private final UserRepository userRepository;
    
    // Конструктор для DI
    public UserService (UserRepository userRepository) {
        this.userRepository = userRepository;
    }
}

// 3. Конфигурационный класс
@Configuration
@ComponentScan ("com.example")  // Сканирует пакет на наличие @Component
public class AppConfig {
    // Дополнительные бины можно объявить здесь
    @Bean
    public DataSource dataSource() {
        return new HikariDataSource();
    }
}
```


**Аннотации для создания бинов:**

- @Component: Делает класс бином.
- @Autowired: Внедряет зависимость.
- @Qualifier: Уточняет бин по имени (если несколько).
- @Primary: Делает бин приоритетным.
- Autowiring by Name: Spring матчит по имени поля/параметра.

**Практический пример:**
```java
@Component
public class EmailService {}  // Бин

@Component
@Primary  // Приоритетный
public class PrimaryEmailService extends EmailService {}

@Component
public class UserController {
    @Autowired
    @Qualifier("emailService")  // Уточнение по имени
    private EmailService service;  // Autowiring by name, если имя совпадает
}
```

**Возможные ошибки:** Несколько бинов без @Qualifier приводят к NoUniqueBeanDefinitionException. Избегайте: Используйте @Primary или @Qualifier.

**Предупреждение:** XML deprecated для новых проектов; используйте аннотации.

| Аннотация | Назначение | Spring Stereotype | Особенности и рекомендации |
|-----------|------------|-------------------|----------------------------|
| `@Component` | Универсальный стереотип для любого класса, который должен управляться Spring | Базовый стереотип | Используется для классов, не подпадающих под более специфичные категории. Имя бина по умолчанию — имя класса с маленькой буквы. |
| `@Service` | Обозначает класс как компонент бизнес-логики (сервисный слой) | Стереотип `@Component` | Поведение идентично `@Component`, но улучшает семантику кода и читаемость. Используется для классов, реализующих бизнес-правила и логику приложения. |
| `@Repository` | Обозначает класс как компонент доступа к данным (DAO, репозиторий) | Стереотип `@Component` | **Ключевая особенность:** автоматически перехватывает и преобразует исключения специфичных для БД технологий (JDBC, JPA, Hibernate) в непроверяемые исключения Spring `DataAccessException`. Также может использоваться для обнаружения persistence-аннотаций. |
| `@Controller` | Обозначает класс как компонент веб-слоя в архитектуре MVC | Стереотип `@Component` | Используется для традиционных веб-приложений с рендерингом представлений (JSP, Thymeleaf). Обрабатывает HTTP-запросы и возвращает имя представления или объект `ModelAndView`. |
| `@RestController` | Специализация `@Controller` для создания RESTful веб-сервисов | Комбинация `@Controller` + `@ResponseBody` | Все методы по умолчанию возвращают данные (JSON/XML), а не имя представления. Эквивалентна аннотированию класса `@Controller` и каждого метода `@ResponseBody`. |
| `@Configuration` | Обозначает класс как источник определений бинов (Java-based конфигурация) | Не является стереотипом `@Component`, но тоже регистрируется как бин | Содержит методы, аннотированные `@Bean`. Spring обрабатывает такие классы особым образом (использует CGLIB-прокси для обеспечения семантики singleton-бинов). |
| `@Bean` | Аннотация для методов в классах `@Configuration` или `@Component`. Указывает, что метод возвращает объект, который должен быть зарегистрирован как бин в контексте. | Не применимо | Используется для явного объявления бинов, особенно когда требуется сложная логика создания или настройка сторонних библиотек. Имя бина по умолчанию — имя метода. |

---

## **Дополнительные Важные аннотации для управления бинами:**

| Аннотация    | Назначение                                                                                                            | Контекст использования                                                                                                                                                             |
| ------------ | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@Scope`     | Определяет область видимости (scope) бина.                                                                            | Может применяться к `@Component`, `@Bean` или другим стереотипам. Значения: `"singleton"` (по умолчанию), `"prototype"`, `"request"`, `"session"`, `"application"`, `"websocket"`. |
| `@Lazy`      | Указывает, что бин должен быть создан лениво (при первом обращении), а не при инициализации контекста.                | Может применяться к `@Component`, `@Bean` или другим стереотипам. Полезно для тяжелых бинов или для разрешения некоторых циклических зависимостей.                                 |
| `@DependsOn` | Указывает, что данный бин зависит от инициализации других бинов, даже если нет прямой ссылки.                         | Может применяться к `@Component`, `@Bean`. Spring гарантирует, что указанные бины будут созданы первыми.                                                                           |
| `@Profile`   | Указывает, что бин активен только при определенном профиле (например, `"dev"`, `"prod"`).                             | Может применяться к `@Component`, `@Bean`, `@Configuration`.                                                                                                                       |
| `@Order`     | Определяет порядок, в котором бины (особенно реализующие интерфейсы) будут использоваться или внедряться в коллекции. | Может применяться к классам, аннотированным стереотипами, или к методам `@Bean`. Меньшее значение = более высокий приоритет.                                                       |
| `@Primary`   | Указывает, что данный бин должен быть выбран по умолчанию при наличии нескольких бинов одного типа.                   | Может применяться к `@Component`, `@Bean`. Имеет меньший приоритет, чем явное указание с помощью `@Qualifier`.                                                                     |
| `@Qualifier` | Уточняет, какой конкретно бин должен быть внедрен, когда есть несколько кандидатов.                                   | Используется вместе с `@Autowired` или `@Inject` на полях, параметрах конструкторов/методов. Также может быть указан на самом классе бина.                                         |

---

## **Сводная Таблица: Когда что использовать?**

| Ситуация                                                                      | Рекомендуемая аннотация                          | Объяснение                                                            |
| ----------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------- |
| Ваш собственный сервис с бизнес-логикой                                       | `@Service`                                       | Четко обозначает роль в архитектуре.                                  |
| Класс для работы с БД (DAO/Repository)                                        | `@Repository`                                    | Дает преимущество в преобразовании исключений.                        |
| Контроллер для веб-страниц (MVC)                                              | `@Controller`                                    | Стандарт для Spring MVC.                                              |
| Контроллер для REST API                                                       | `@RestController`                                | Упрощает создание REST-сервисов.                                      |
| Вспомогательный компонент (утилита, хелпер)                                   | `@Component`                                     | Универсальный выбор для классов без четкой роли из вышеперечисленных. |
| Нужно сконфигурировать бин из сторонней библиотеки (DataSource, RestTemplate) | `@Bean` внутри класса `@Configuration`           | Дает полный контроль над созданием и настройкой экземпляра.           |
| Нужно создать несколько бинов одного типа с разной конфигурацией              | `@Bean` с разными именами методов + `@Qualifier` | Позволяет явно различать бины.                                        |
| Хотите, чтобы один бин выбирался по умолчанию из нескольких                   | `@Primary` на основном бине                      | Упрощает инъекцию в большинстве мест.                                 |
| Нужно явно указать, какой бин внедрять в конкретном случае                    | `@Qualifier` вместе с `@Autowired`               | Обеспечивает точность и ясность.                                      |
| Бин тяжелый и не всегда используется                                          | `@Lazy`                                          | Оптимизирует время запуска приложения.                                |
| Бин должен существовать в единственном экземпляре на все приложение           | `@Scope("singleton")` (по умолчанию)             | Стандартное поведение.                                                |
| При каждом запросе нужен новый экземпляр бина                                 | `@Scope("prototype")`                            | Полезно для stateful-бинов.                                           |
|                                                                               |                                                  |                                                                       |

---

### 3. Через Java-based конфигурацию (`@Configuration` и `@Bean`)

Это подход, при котором конфигурация описывается на Java, а не в XML. Он сочетает в себе преимущества централизованного управления (как XML) и типобезопасность/рефакторинг (как аннотации).

```java
@Configuration // Говорит Spring: "Этот класс содержит определения бинов"
public class AppConfig {

    // Метод, аннотированный @Bean, сообщает Spring:
    // "Верни объект, который должен быть зарегистрирован как бин в контексте".
    // Имя бина по умолчанию — имя метода.
    @Bean
    public UserRepository userRepository() {
        return new UserRepositoryImpl();
    }

    // Spring увидит, что для создания этого бина нужен бин типа UserRepository.
    // Он вызовет метод userRepository() и передаст результат сюда.
    @Bean
    public UserService userService(UserRepository repo) {
        UserService service = new UserService(repo);
        service.setTimeout(5000); // Дополнительная настройка
        return service;
    }

    // Бин с внешней конфигурацией (например, из application.properties)
    @Bean
    public DataSource dataSource(
            @Value("${db.url}") String url,
            @Value("${db.username}") String username,
            @Value("${db.password}") String password) {
        HikariDataSource ds = new HikariDataSource();
        ds.setJdbcUrl(url);
        ds.setUsername(username);
        ds.setPassword(password);
        return ds;
    }

    // Бин с квалификатором и условием
    @Bean
    @Qualifier("primaryNotification")
    @ConditionalOnProperty(name = "notification.email.enabled", havingValue = "true")
    public NotificationService emailNotificationService() {
        return new EmailNotificationService();
    }

    @Bean
    @Profile("dev") // Создается только при активном профиле "dev"
    public DataSource devDataSource() {
        return new EmbeddedDatabaseBuilder()
                .setType(EmbeddedDatabaseType.H2)
                .addScript("classpath:schema-dev.sql")
                .build();
    }
}
```

**Преимущества Java Config:**
- **Полная типобезопасность.** Ошибки конфигурации ловятся на этапе компиляции.
- **Мощь Java.** Можно использовать условия, циклы, вызовы других методов.
- **Легкий рефакторинг.** IDE поможет переименовать методы и классы.
- **Прозрачность.** Легко отладить, поставив точку останова в методе `@Bean`.

**Недостатки:**
- **Изменение конфигурации требует перекомпиляции.** В отличие от XML.
- **Может быть более многословным**, чем аннотации на самих классах.

## Жизненный цикл бина и callback-методы

Spring предоставляет несколько способов выполнить код на разных этапах жизни бина.

```java
@Component
public class LifecycleBean implements InitializingBean, DisposableBean {

    // 1. Конструктор
    public LifecycleBean() {
        System.out.println("1. Конструктор");
    }

    // 2. @PostConstruct (JSR-250) - РЕКОМЕНДУЕМЫЙ СПОСОБ
    @PostConstruct
    public void postConstruct() {
        System.out.println("3. @PostConstruct - бин инициализирован, зависимости внедрены");
    }

    // 3. afterPropertiesSet() из InitializingBean
    @Override
    public void afterPropertiesSet() {
        System.out.println("4. InitializingBean.afterPropertiesSet()");
    }

    // 4. initMethod из @Bean
    public void customInit() {
        System.out.println("5. Custom init-method");
    }

    // 5. @PreDestroy (JSR-250) - РЕКОМЕНДУЕМЫЙ СПОСОБ
    @PreDestroy
    public void preDestroy() {
        System.out.println("6. @PreDestroy - контекст закрывается");
    }

    // 6. destroy() из DisposableBean
    @Override
    public void destroy() {
        System.out.println("7. DisposableBean.destroy()");
    }

    // 7. destroyMethod из @Bean
    public void customDestroy() {
        System.out.println("8. Custom destroy-method");
    }
}

// Конфигурация с указанием init/destroy методов
@Configuration
class Config {
    @Bean(initMethod = "customInit", destroyMethod = "customDestroy")
    public LifecycleBean lifecycleBean() {
        return new LifecycleBean();
    }
}
```

**Порядок вызова при создании:**
1. Конструктор
2. Внедрение зависимостей (через поле/сеттер)
3. `@PostConstruct`
4. `InitializingBean.afterPropertiesSet()`
5. Кастомный `initMethod`

**Порядок вызова при уничтожении:**
1. `@PreDestroy`
2. `DisposableBean.destroy()`
3. Кастомный `destroyMethod`

**Рекомендация:** Используйте `@PostConstruct` и `@PreDestroy` (стандарт JSR-250), а не Spring-специфичные интерфейсы. Это делает код менее связанным с фреймворком.

---

# <a name="9"></a>9. Аннотации: `@Component`, `@Autowired`, `@Qualifier`, `@Primary`

## `@Component` — Базовый стереотип

Это общая аннотация для любого компонента, управляемого Spring. Это маркер, говорящий: "Экземпляр этого класса нужно создать и поместить в контекст как бин".

```java
@Component // Имя бина по умолчанию: "userRepositoryImpl" (decapitalized имя класса)
public class UserRepositoryImpl implements UserRepository {
    // ...
}
```

**Специализированные производные `@Component` (для улучшения семантики):**
- **`@Service`**: Обозначает класс как сервисный слой (бизнес-логика). Поведение идентично `@Component`, но улучшает читаемость.
- **`@Repository`**: Обозначает класс как репозиторий (DAO, доступ к данным). Добавляет **перехват исключений**. Исключения специфичные для JDBC/Hibernate (например, `SQLException`) преобразуются в непроверяемые исключения Spring DataAccessException.
- **`@Controller` / `@RestController`**: Обозначает класс как контроллер веб-слоя (MVC или REST).

```java
@Service // Четко указывает на роль класса
public class UserRegistrationService {
    // Бизнес-логика регистрации
}

@Repository // Spring будет перехватывать и трансформировать исключения БД
public class JpaUserRepository implements UserRepository {
    @PersistenceContext
    private EntityManager em;
    // ...
}

@RestController // = @Controller + @ResponseBody на каждом методе
@RequestMapping("/api/users")
public class UserApiController {
    // Обработка HTTP-запросов
}
```

## `@Autowired` — Запрос на внедрение зависимости

Указывает Spring, что нужно автоматически найти подходящий бин и внедрить его.

**Где можно ставить:**
1. **На конструкторе (рекомендуется):**
    ```java
    @Service
    public class UserService {
        private final UserRepository repo;
        @Autowired // Необязательно с Spring 4.3+, если только один конструктор
        public UserService(UserRepository repo) {
            this.repo = repo;
        }
    }
    ```
2. **На поле (не рекомендуется для mandatory зависимостей):**
    ```java
    @Service
    public class UserService {
        @Autowired
        private UserRepository repo; // Reflection! Сложно тестировать без Spring.
    }
    ```
3. **На сеттере или произвольном методе:**
    ```java
    @Service
    public class UserService {
        private UserRepository repo;
        @Autowired
        public void setRepository(UserRepository repo) {
            this.repo = repo;
        }
        @Autowired // Можно внедрять несколько зависимостей через один метод
        public void configure(UserRepository repo, @Value("${timeout}") int timeout) {
            this.repo = repo;
            this.timeout = timeout;
        }
    }
    ```

**Модификаторы `@Autowired`:**
- `@Autowired(required = true)` (по умолчанию): Если подходящий бин не найден, контекст не запустится.
- `@Autowired(required = false)`: Зависимость опциональна. Если бин не найден, поле останется `null`, аргумент метода будет `null`. **Лучшая альтернатива — использовать `Optional<>` или `@Nullable`.**

    ```java
    // Способ 1: required = false
    @Autowired(required = false)
    private CacheManager cacheManager;

    // Способ 2: Optional (более явно и типобезопасно)
    @Autowired
    private Optional<CacheManager> cacheManagerOpt;

    // Способ 3: Аннотация @Nullable (javax.annotation или Spring)
    @Autowired
    public void setCacheManager(@Nullable CacheManager cacheManager) {
        // ...
    }
    ```

## Проблема: Неоднозначность (Multiple Beans)

Что произойдет, если в контексте несколько бинов, подходящих по типу?

```java
// Две реализации одного интерфейса
@Component("emailService")
public class EmailNotificationService implements NotificationService { /*...*/ }

@Component("smsService")
public class SmsNotificationService implements NotificationService { /*...*/ }

@Service
public class UserService {
    @Autowired // ОШИБКА! Какой бин внедрить? Email или Sms?
    private NotificationService notificationService;
}
```

### Решение 1: `@Qualifier` — указание имени конкретного бина

Аннотация уточняет, **какой именно** бин нужно внедрить, используя его идентификатор.

```java
@Service
public class UserService {
    // Внедряем бин с именем "emailService"
    @Autowired
    @Qualifier("emailService")
    private NotificationService notificationService;
}

// Или в конструкторе
@Service
public class UserService {
    private final NotificationService notificationService;
    @Autowired
    public UserService(@Qualifier("smsService") NotificationService notificationService) {
        this.notificationService = notificationService;
    }
}

// Можно задать квалификатор прямо на классе бина
@Component
@Qualifier("email") // Теперь у бина есть квалификатор "email"
public class EmailNotificationService implements NotificationService { /*...*/ }

@Service
public class UserService {
    @Autowired
    @Qualifier("email") // Ищем бин с квалификатором "email"
    private NotificationService notificationService;
}
```

### Решение 2: `@Primary` — указание бина по умолчанию

Помечает один из бинов как **предпочтительный (primary)**. Если есть неоднозначность, будет выбран бин с `@Primary`.

```java
@Component
@Primary // Этот бин будет выбран по умолчанию
public class EmailNotificationService implements NotificationService { /*...*/ }

@Component
public class SmsNotificationService implements NotificationService { /*...*/ }

@Service
public class UserService {
    @Autowired // Будет внедрен EmailNotificationService
    private NotificationService notificationService;
}
```

**Важно:** `@Qualifier` имеет приоритет над `@Primary`. Если указан `@Qualifier`, Spring будет искать именно его, игнорируя `@Primary`.

### Решение 3: Autowiring by Name (автосвязывание по имени)

Если не указан `@Qualifier`, Spring в качестве fallback стратегии попробует найти бин, **имя которого совпадает с именем поля/параметра**.

```java
@Component // Имя бина: "emailNotificationService"
public class EmailNotificationService implements NotificationService { /*...*/ }

@Component // Имя бина: "smsNotificationService"
public class SmsNotificationService implements NotificationService { /*...*/ }

@Service
public class UserService {
    @Autowired
    // Имя поля "emailNotificationService" совпадает с именем бина!
    private NotificationService emailNotificationService; // Внедрится EmailNotificationService

    @Autowired
    // Имя параметра "smsNotificationService" совпадает с именем бина!
    public void setSmsService(NotificationService smsNotificationService) {
        // ...
    }
}
```

**Порядок разрешения неоднозначности `@Autowired`:**
1.  Ищется бин, подходящий по типу.
2.  Если найден ровно один — он используется.
3.  Если найдено несколько:
    a) Проверяется, есть ли среди них бин с `@Primary` — он выбирается.
    b) Проверяется, указан ли `@Qualifier` — ищется бин с таким квалификатором.
    C) Пытается сопоставить по имени поля/параметра (autowiring by name).
4.  Если после всех шагов неоднозначность не устранена — выбрасывается `NoUniqueBeanDefinitionException`.

## Продвинутый пример: Инъекция коллекций

Spring может автоматически внедрять **все** бины определенного типа в `List`, `Set`, `Map` или даже массив.

```java
@Component
public class NotificationDispatcher {
    // Список ВСЕХ бинов, реализующих NotificationService
    @Autowired
    private List<NotificationService> allServices; // [Email..., Sms...]

    // Set для уникальности
    @Autowired
    private Set<NotificationService> uniqueServices;

    // Map, где ключ — имя бина, значение — сам бин
    @Autowired
    private Map<String, NotificationService> serviceMap;
    // serviceMap = {"emailNotificationService": Email..., "smsNotificationService": Sms...}

    // Массив
    @Autowired
    private NotificationService[] serviceArray;

    // Если нужны бины с определенным Qualifier
    @Autowired
    @Qualifier("email")
    private List<NotificationService> emailServices; // Только бины с @Qualifier("email")
}
```

Это мощный механизм для реализации паттернов вроде **Chain of Responsibility** или **стратегий**, когда логика распределена между несколькими компонентами.

---

# <a name="10"></a>10. Просмотр бинов в дебаггере

Умение исследовать состояние Spring контекста в дебаггере — критически важный навык для решения реальных проблем.

## Что можно увидеть в дебаггере:

1.  **Полный список всех бинов** в контексте.
2.  **Состояние конкретного бина** (значения его полей).
3.  **Граф зависимостей** (какие бины внедрены в другие).
4.  **Проблемы** (например, `null` там, где должна быть зависимость).

## Практический пример отладки:

Допустим, у нас есть проблема: `NullPointerException` в `UserService`.

```java
@Service
public class UserService {
    @Autowired
    private UserRepository userRepository; // Подозреваем, что здесь null

    public void processUser(Long id) {
        // NPE здесь!
        User user = userRepository.findById(id); // userRepository == null
        // ...
    }
}
```

**Шаги отладки:**

1.  **Установите точку останова** в конструкторе `UserService` или в методе `processUser`.
2.  **Запустите приложение в режиме отладки.**
3.  **В отладчике исследуйте переменную `this` (экземпляр `UserService`).**
    - Найдите поле `userRepository`. Его значение, скорее всего, будет `null`.
    - Это означает, что Spring не смог внедрить зависимость.

4.  **Проверьте контекст Spring.** Вам нужно получить доступ к `ApplicationContext`. Есть несколько способов:
    - **Способ 1:** Внедрить `ApplicationContext` в какой-нибудь бин и посмотреть на него.
        ```java
        @Component
        public class ContextDebugBean implements ApplicationContextAware {
            private ApplicationContext context;
            @Override
            public void setApplicationContext(ApplicationContext ctx) {
                this.context = ctx;
            }
            public ApplicationContext getContext() { return context; }
        }
        ```
      В дебаггере найдите бин `contextDebugBean` и вызовите `getContext()`.
    - **Способ 2 (в Spring Boot):** Воспользоваться `ApplicationContext` из `SpringApplication.run()`.
    - **Способ 3:** Использовать **Expression Evaluation** в дебаггере (например, в IntelliJ IDEA). Если у вас есть доступ к классу, который хранит ссылку на контекст (часто это главный класс приложения), вы можете написать выражение для его вычисления.

5.  **Исследуйте контекст.** В переменной контекста найдите поле, которое хранит все бины. Обычно это что-то вроде `beanFactory` -> `singletonObjects` (это `ConcurrentHashMap`).
    - Пройдите по этой мапе и убедитесь, что бин `userRepository` существует.
    - Проверьте его тип. Может быть, вы ожидали `JdbcUserRepository`, а в контексте лежит `JpaUserRepository`?

6.  **Проверьте имена бинов.** Возможно, используется `@Qualifier`, и имя бина не совпадает с ожидаемым.

**Типичные находки при отладке контекста:**
- **Отсутствующий бин:** Класс не помечен как `@Component`, или он находится вне зоны сканирования (`@ComponentScan`).
- **Дубликаты бинов:** Несколько бинов одного типа, и ни один не `@Primary`, не указан `@Qualifier`.
- **Циклическая зависимость:** Spring может создать proxy, и в отладчике вы увидите не ваш класс, а `UserService$$EnhancerBySpringCGLIB`.
- **Бин создан, но зависимости не внедрены:** Частая проблема при использовании `new` вместо получения бина из контекста.

---

# <a name="11"></a>11. Инструменты для просмотра бинов

## 1. IntelliJ IDEA Ultimate — встроенные средства

IDEA Ultimate имеет превосходную встроенную поддержку Spring.

**а) Вкладка "Spring" в окне Run/Debug:**
- После запуска Spring Boot приложения в IDE откройте вкладку **Spring** внизу.
- Там вы увидите дерево всех бинов, сгруппированных по типам и пакетам.
- Можно фильтровать, искать, просматривать свойства бинов.

**б) Иконки на полях в редакторе кода:**
- Рядом с аннотациями `@Autowired`, `@Bean`, `@Component` появляются специальные иконки.
- Клик по ним показывает, куда ведет инъекция или откуда берется бин.
- **Зеленая буква 'S'** или **фиолетовый Spring-логотип** указывают на Spring-бины.

**в) Навигация "Related Beans":**
- ПКМ на классе -> **Find Usages** (Alt+F7) или **Navigate** -> **Related Beans**.
- Показывает, где этот бин используется и какие бины в него внедряются.

**г) Диаграмма зависимостей (Dependency Diagram):**
- В окне проекта ПКМ на классе конфигурации или любом бине -> **Diagrams** -> **Show Diagram**.
- Можно выбрать **Show Dependencies** или **Show Spring Beans**. Визуализирует граф бинов.

## 2. Плагины для IntelliJ IDEA Community Edition и других IDE

Поскольку Spring Tools входят только в Ultimate, для Community Edition нужны плагины.

- **Spring Assistant** / **Spring Boot Helper**: Популярные плагины, добавляющие базовую поддержку Spring (подсветку, навигацию, создание бинов).
- **Cloud Toolkit**: Некоторые плагины от облачных провайдеров (AWS, Azure) включают инструменты для Spring.

**Важно:** Функциональность плагинов значительно уступает встроенным средствам Ultimate.

## 3. Spring Boot Actuator — продвинутый инструмент для runtime

Actuator предоставляет HTTP-эндпоинты для мониторинга и управления приложением. Это **лучший способ** исследовать контекст в работающем (production) приложении.

**Добавление зависимости:**
```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
```

**Настройка в `application.yml`:**
```yaml
management:
  endpoints:
    web:
      exposure:
        include: beans, health, info, metrics # Открываем нужные эндпоинты
  endpoint:
    beans:
      enabled: true # Явно включаем эндпоинт /actuator/beans
```

**Полезные эндпоинты:**
- **`GET /actuator/beans`**: Выводит **полный список всех бинов** в JSON-формате. Для каждого бина указаны его зависимости (scope, тип, квалификаторы). Невероятно полезно!
- **`GET /actuator/health`**: Статус здоровья приложения.
- **`GET /actuator/metrics`**: Метрики приложения.
- **`GET /actuator/env`**: Все переменные окружения и свойства.
- **`GET /actuator/mappings`**: Все HTTP-маппинги (контроллеры).

**Пример вывода `/actuator/beans` (сокращенно):**
```json
{
  "contexts": {
    "application": {
      "beans": {
        "userService": {
          "aliases": [],
          "scope": "singleton",
          "type": "com.example.service.UserService",
          "resource": "file [com/example/service/UserService.class]",
          "dependencies": ["userRepository"] // Видим граф зависимостей!
        },
        "userRepository": {
          "aliases": [],
          "scope": "singleton",
          "type": "com.example.repository.JpaUserRepository",
          "resource": "file [com/example/repository/JpaUserRepository.class]",
          "dependencies": ["entityManagerFactory"]
        }
      }
    }
  }
}
```

## 4. Консольные команды и логи

- **Логирование уровня DEBUG:** В логах Spring при старте выводит информацию о создаваемых бинах.
    ```yaml
    logging:
      level:
        org.springframework.context: DEBUG # Будет очень подробный вывод
    ```
- **Spring Boot CLI:** Утилита `spring` имеет команды для инспекции приложения.

## Рекомендация

Для разработки используйте **IntelliJ IDEA Ultimate** — это инвестиция в продуктивность. Для продакшн-диагностики незаменим **Spring Boot Actuator**.

---

# <a name="12"></a>12. FAQ — Ответы на типичные вопросы (оставшееся время)

**Вопрос 1: Всегда ли нужно использовать Spring? Нет ли избыточности для маленьких проектов?**
> **Ответ:** Нет, не всегда. Для tiny-утилит или микросервисов с одной ответственностью можно обойтись без Spring (или использовать только Core контейнер). Однако Spring Boot настолько упрощает настройку, что часто проще начать с него даже для small проектов. Избыточность минимальна, а выгода в структурированности и готовности к росту — велика.

**Вопрос 2: `@Autowired` на поле vs конструктор. Что реально лучше и почему?**
> **Ответ:** **Конструктор.** Это best practice. Причины:
> 1) **Неизменяемость** (поля `final`).
> 2) **Гарантия полной инициализации** объекта.
> 3) **Простота тестирования** (можно создать объект через `new`).
> 4) **Обнаружение циклических зависимостей** на этапе подъема контекста. Field injection скрывает зависимости, усложняет тесты и поощряет нарушение инкапсуляции.

**Вопрос 3: Что делать, если Spring не видит мой `@Component` класс?**
> **Ответ:** Пошаговый чек-лист:
> 1.  Убедитесь, что класс находится в пакете **внутри или ниже** пакета, указанного в `@ComponentScan`. По умолчанию в Spring Boot сканируется пакет главного класса (`@SpringBootApplication`) и все его подпакеты.
> 2.  Проверьте, есть ли аннотация `@Component` (или `@Service`, `@Repository`, `@Controller`).
> 3.  Убедитесь, что ваш класс **не абстрактный**.
> 4.  Проверьте, нет ли фильтров в `@ComponentScan` (например, `excludeFilters`), которые могли исключить ваш класс.
> 5.  Используйте логирование уровня `DEBUG` для `org.springframework.context`, чтобы увидеть процесс сканирования.

**Вопрос 4: В чем разница между `@Bean` и `@Component`?**
> **Ответ:**
> - **`@Component`** (и его стереотипы) — это **стереотип класса**. Вы помечаете сам класс, и Spring создает бин из него автоматически, используя конструктор по умолчанию (или единственный конструктор).
> - **`@Bean`** — это **стереотип метода**. Вы помечаете метод в классе `@Configuration`. Spring вызовет этот метод и зарегистрирует возвращаемый объект как бин. Это дает полный контроль над созданием бина (вызов специфичного конструктора, настройка полей, условная логика).
    > **Используйте `@Component`** для ваших собственных классов. **Используйте `@Bean`** для настройки бинов из сторонних библиотек (например, `DataSource`, `RestTemplate`) или когда нужна сложная логика создания.

**Вопрос 5: Как правильно обрабатывать опциональные зависимости?**
> **Ответ:** Есть три основных способа, от худшего к лучшему:
> 1.  `@Autowired (required = false)` — старый способ, может привести к NPE, если забыть проверить на `null`.
> 2.  Использование `Optional<T>` — современный, типобезопасный способ. Явно показывает, что зависимость может отсутствовать.
> 3.  **Паттерн Null Object** — создать специальную, "пустую" реализацию интерфейса, которая ничего не делает. Это полностью устраняет проверки на `null` в бизнес-логике.


> **Пример с `Optional`:**

```java
@Service
public class MyService {
    private final Optional<CacheManager> cacheManager;

     @Autowired
     public MyService(Optional<CacheManager> cacheManager) {
         this.cacheManager = cacheManager;
     }
     
     public void someMethod() {
         cacheManager.IfPresent (cm -> cm.GetCache ("myCache"));
         // Или if (cacheManager.IsPresent ()) { ... }
    }
 }
```

**Вопрос 6: `@Qualifier` vs `@Primary` — когда что использовать?**
> **Ответ:**
> - **`@Primary`** — это **глобальная настройка по умолчанию**. Используйте, когда у вас есть одна "основная" реализация, которая должна использоваться в 80% случаев инъекции. Например, основная `DataSource` для БД.
> - **`@Qualifier`** — это **точечная, явная спецификация**. Используйте, когда в разных местах нужны разные реализации. Например, `@Qualifier ("emailService")` для отправки уведомлений по почте и `@Qualifier ("smsService")` для SMS.
    > **Правило:** `@Qualifier` всегда побеждает `@Primary`. Если нужна явность и ясность — используйте `@Qualifier`.

**Вопрос 7: Как Spring Boot автоматически настраивает бины? Это же магия!**
> **Ответ:** Это не магия, а хорошо продуманный механизм **автоконфигурации** (`@EnableAutoConfiguration`). Вот как это работает:
> 1.  Spring Boot смотрит в ваш `classpath`.
> 2.  Видит, например, библиотеку `spring-boot-starter-data-jpa` и драйвер `h2`.
> 3.  В этой стартер-зависимости есть файл `META-INF/spring. Factories`, который указывает на классы автоконфигурации (например, `DataSourceAutoConfiguration`, `JpaRepositoriesAutoConfiguration`).
> 4.  Эти классы-конфигурации содержат условные аннотации (`@ConditionalOnClass`, `@ConditionalOnMissingBean`, `@ConditionalOnProperty`).
> 5.  Если условия выполняются (класс в classpath, бин такого типа еще не создан), Spring Boot создает и настраивает бин с разумными значениями по умолчанию.
      > **Вы всегда можете переопределить** автоконфигурацию, просто объявив свой собственный бин того же типа в вашей конфигурации. Ваш бин будет иметь приоритет.

**Вопрос 8: Что такое циклическая зависимость и как ее избежать?**
> **Ответ:** Циклическая зависимость (A → B → A) возникает, когда два или более бина зависят друг от друга. Spring может разрешить некоторые циклы (используя обходные механизмы, например, внедрение через сеттеры или создание proxy), но это **антипаттерн**, указывающий на плохой дизайн.
> **Способы решения:**
> 1.  **Рефакторинг:** Выделите общую логику в третий сервис. Используйте паттерн "Медиатор" или "Наблюдатель" (events).
> 2.  **`@Lazy`:** Сделайте одну из зависимостей "ленивой". Spring внедрит proxy, который будет инициализирован только при первом обращении.
> 3.  **Setter/Field Injection:** Вместо конструктора (но это лечит симптом, а не причину).
> 4.  **`ApplicationContextAware`:** Получить зависимость явно из контекста уже после создания бина (крайняя мера).
---

# Итог лекции

Сегодня мы прошли путь от понимания, **что такое фреймворк**, до глубокого погружения в сердце Spring — **IoC контейнер и Dependency Injection**. Вы узнали:

1.  **Почему** DI и IoC решают фундаментальные проблемы поддержки и тестирования кода.
2.  **Как** Spring создает и управляет бинами через XML, аннотации и Java Config.
3.  **Какие** есть способы внедрения зависимостей и почему **constructor injection — король**.
4.  **Как** разрешать неоднозначности с помощью `@Qualifier` и `@Primary`.
5.  **Как** исследовать и отлаживать контекст Spring с помощью IDE и Actuator.

**Ключевая мысль:** Spring — это не волшебная палочка, а набор продуманных инструментов, которые **навязывают вам хорошие архитектурные практики** (слабая связность, инъекция зависимостей, разделение ответственности). Понимание его внутренней работы превращает вас из пользователя в архитектора.
