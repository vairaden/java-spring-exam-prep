---
title: "8. Аннотации конфигураций"
description: "@Configuration, @ComponentScan, @Import, @Profile, @Primary, @DependsOn, @Order"
---

> Аннотации конфигураций: @Configuration, @ComponentScan, @Import, @Profile, @Primary, @DependsOn, @Order.

## @Configuration

Помечает класс как источник определений бинов. Методы с `@Bean` создают бины. По умолчанию
работает в режиме **proxyBeanMethods=true** (full mode): класс оборачивается CGLIB-прокси,
поэтому повторный вызов `@Bean`-метода возвращает **тот же singleton**, а не новый объект.
```java
@Configuration
public class AppConfig {
    @Bean public TaskRepository repo() { return new InMemoryTaskRepository(); }
    @Bean public TaskService service() { return new TaskService(repo()); } // repo() — тот же бин
}
```

## @ComponentScan

Указывает пакеты для сканирования классов со стереотипами (`@Component` и т.д.). Входит в
состав `@SpringBootApplication`, который сканирует пакет главного класса и подпакеты.
Можно настраивать `basePackages`, `includeFilters`/`excludeFilters`.

## @Import

Подключает другие конфигурации/компоненты в текущий контекст:
```java
@Configuration
@Import({SecurityConfig.class, WebConfig.class})
public class AppConfig {}
```
Позволяет собирать контекст из модульных конфигов без component scan.

## @Profile

Активирует бин/конфигурацию только в определённом **профиле** (`dev`, `prod`, `test`):
```java
@Bean
@Profile("dev")
public DataSource h2() { ... }   // создаётся только при активном профиле dev

@Bean
@Profile("prod")
public DataSource postgres() { ... }
```
Профиль активируется через `spring.profiles.active=dev` или `--spring.profiles.active`.

## @Primary

При неоднозначности (несколько бинов одного типа) помечает бин «по умолчанию» — он будет
выбран без `@Qualifier`:
```java
@Bean @Primary public TaskRepository inMemory() { ... }
@Bean           public TaskRepository stub()     { ... }
```

## @DependsOn

Принудительно задаёт **порядок инициализации**: бин не создастся, пока не созданы указанные.
Нужно, когда зависимость **неявная** (нет прямой DI-связи), но важна последовательность
(например, регистрация драйвера, прогрев кеша):
```java
@Bean @DependsOn("flywayMigrator")
public Service service() { ... }
```

## @Order

Задаёт порядок в **коллекции бинов** (когда внедряется `List<T>`), а также порядок
фильтров, `CommandLineRunner`, перехватчиков, аспектов. Меньшее значение = выше приоритет.
```java
@Component @Order(1) class FirstHandler implements Handler {}
@Component @Order(2) class SecondHandler implements Handler {}
// @Autowired List<Handler> handlers — в порядке Order
```
`@Order` влияет на **порядок в списке/цепочке**, а `@DependsOn` — на **порядок создания** бинов.

## 🔗 Смежные вопросы
- [Б1.2 — IoC и DI](/block-1/02-ioc-di/)
- [Б1.7 — Стереотипы и скоупы](/block-1/07-bean-scopes/)
- [Б1.9 — Properties и конфигурация (@Profile)](/block-1/09-properties/)

## 📚 Материалы
- [Лонгрид 3 — Стереотипные аннотации и конфигурирование](/longreads/03-stereotypes-config/)
