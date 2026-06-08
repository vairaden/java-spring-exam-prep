---
title: Список вопросов
description: Все 40 экзаменационных вопросов по трём блокам со ссылками на ответы.
---

## Блок 1. Spring Core & Web

1. [Фреймворк. Отличие библиотеки от фреймворка. Преимущества и недостатки. Что такое Spring и Spring Boot.](/block-1/01-frameworks/)
2. [Инверсия управления. Внедрение зависимостей (конструктор, поле, сеттер). @Autowired, @Qualifier. Конфигурирование: XML / annotation / java.](/block-1/02-ioc-di/)
3. [Виды архитектур: слоистая, модульная, чистая.](/block-1/03-architectures/)
4. [AOP. Join Point, Pointcut, Advice, Aspect.](/block-1/04-aop-concepts/)
5. [AOP. Spring AOP, CGLIB и JDK Dynamic proxies. AspectJ и Weaving.](/block-1/05-aop-proxies/)
6. [Bean. Жизненный цикл.](/block-1/06-bean-lifecycle/)
7. [Bean. Стереотипные аннотации. Скоупы. ObjectFactory, ObjectProvider, Provider.](/block-1/07-bean-scopes/)
8. [Аннотации конфигураций: @Configuration, @ComponentScan, @Import, @Profile, @Primary, @DependsOn, @Order.](/block-1/08-config-annotations/)
9. [Properties. @Value, @PropertySource, @ConfigurationProperties. application.properties и application.yaml.](/block-1/09-properties/)
10. [Servlet. DispatcherServlet. Путь запроса в Spring MVC. Полный цикл обработки HTTP-запроса.](/block-1/10-dispatcherservlet/)
11. [Контейнеры сервлетов: Tomcat, Jetty, Undertow, Netty.](/block-1/11-servlet-containers/)
12. [Формирование ответов. ResponseEntity. Кастомные хедеры. CORS.](/block-1/12-responses-cors/)
13. [@Controller, @RestController, @RequestMapping, @RequestBody, @PathVariable, @RequestParam. DTO. Маппинг. Валидация.](/block-1/13-controllers-dto/)
14. [Загрузка файлов: raw и MultipartFile. Состояние: заголовки, куки, сессии.](/block-1/14-file-upload-state/)
15. [Обработка ошибок. @ControllerAdvice. @ExceptionHandler.](/block-1/15-error-handling/)
16. [HTTP. REST. OpenAPI + Spring. Генерация контроллеров и клиентов.](/block-1/16-rest-openapi/)
17. [Логирование. SLF4J и реализации. Уровни, конфигурация. MDC.](/block-1/17-logging/)
18. [Тестирование. Unit / интеграционное / E2E. @SpringBootTest, @WebMvcTest, @MockBean, @SpyBean, MockMvc, Testcontainers.](/block-1/18-testing/)

## Блок 2. Persistence & Security

1. [JDBC: Statement, PreparedStatement, ResultSet. Запросы. Транзакции. Driver.](/block-2/01-jdbc/)
2. [Spring JDBC. Connection pool. DataSource. JdbcTemplate.](/block-2/02-spring-jdbc/)
3. [Императивные и декларативные транзакции. Уровни изоляции. Propagation.](/block-2/03-transactions/)
4. [Миграции: Flyway (Liquibase).](/block-2/04-migrations/)
5. [JPA и Hibernate. Принцип работы. @Table, @Id, @GeneratedValue, @Column. JPA-репозитории.](/block-2/05-jpa-hibernate/)
6. [Hibernate. Жизненный цикл сущности.](/block-2/06-entity-lifecycle/)
7. [Hibernate. Связи и каскадные операции.](/block-2/07-associations/)
8. [Hibernate. Производительность: кеширование, проблема N+1.](/block-2/08-performance/)
9. [Hibernate. Пагинация и сортировка.](/block-2/09-pagination/)
10. [Spring Data Repository. Новые методы. JPQL, HQL.](/block-2/10-spring-data/)
11. [Spring Security. Архитектура и конфигурирование. AuthenticationManager. PasswordEncoder. JWT.](/block-2/11-security/)
12. [RestClient. HTTP-запросы. Хедеры. Базовая авторизация. Обработка ответов и исключений.](/block-2/12-restclient/)
13. [Rate limiter и Circuit breaker. Resilience4j.](/block-2/13-resilience4j/)

## Блок 3. Reactive, Kafka, Monitoring

1. [Реактивное программирование. Project Reactor. Reactive Streams. Тестирование.](/block-3/01-reactor/)
2. [Реактивное программирование. Spring WebFlux. Netty и EventLoop. Тестирование.](/block-3/02-webflux/)
3. [Реактивное программирование. R2DBC. Блокировка потоков. Проблемы JDBC в реактивном стеке.](/block-3/03-r2dbc/)
4. [Реактивное программирование. Реактивные транзакции. Полный путь обработки реактивного запроса.](/block-3/04-reactive-tx/)
5. [Apache Kafka. Topic, partition, offset, consumer group. Replication и ISR. Отличия от других инструментов.](/block-3/05-kafka-basics/)
6. [Kafka консьюмер. Архитектура, конфигурации. Batch консьюмер. Пропускная способность.](/block-3/06-kafka-consumer/)
7. [Kafka продьюсер. Архитектура. KafkaTemplate, RoutingKafkaTemplate, ReplyKafkaTemplate. Пропускная способность.](/block-3/07-kafka-producer/)
8. [4 золотых сигнала. Типы метрик Prometheus (Counter, Gauge, Histogram, Summary). Квантили и персентили.](/block-3/08-monitoring-metrics/)
9. [Spring Actuator: эндпоинты, конфигурации. Micrometer: Prometheus и Grafana. Оверхед метрик.](/block-3/09-actuator/)
