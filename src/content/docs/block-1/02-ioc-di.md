---
title: "2. Инверсия управления и внедрение зависимостей"
description: "IoC, DI (конструктор/поле/сеттер), @Autowired, @Qualifier, способы конфигурирования"
---

> Инверсия управления. Внедрение зависимостей, типы: конструктор, поле, сеттер. @Autowired, @Qualifier. Конфигурирование: XML-based, annotation-based, java-based.

## Инверсия управления (IoC)

**IoC** — передача управления созданием и жизненным циклом объектов внешней сущности
(контейнеру). Вместо `new Service()` объект просит зависимости, а контейнер их предоставляет.
**Внедрение зависимостей (DI)** — конкретная реализация IoC: контейнер «вкалывает»
готовые зависимости в объект. В Spring контейнер — это `ApplicationContext`.

Зачем: слабая связанность, тестируемость (можно подменить зависимость моком), единая
точка управления конфигурацией.

## Типы внедрения зависимостей

**1. Через конструктор (рекомендуется):**
```java
@Service
public class TaskService {
    private final TaskRepository repo;
    public TaskService(TaskRepository repo) { // @Autowired необязателен с одним конструктором
        this.repo = repo;
    }
}
```
Плюсы: зависимости `final` (иммутабельны), объект всегда в валидном состоянии, видно
обязательные зависимости, легко тестировать без Spring, нет циклических зависимостей незаметно.

**2. Через поле (field injection):**
```java
@Autowired
private TaskRepository repo;
```
Минусы: нельзя сделать `final`, скрытые зависимости, нельзя создать объект без рефлексии в тестах. Не рекомендуется.

**3. Через сеттер:**
```java
@Autowired
public void setRepo(TaskRepository repo) { this.repo = repo; }
```
Подходит для **опциональных** зависимостей и переконфигурирования.

## @Autowired

Помечает точку внедрения — Spring находит подходящий бин **по типу** (by type) и внедряет.
`@Autowired(required = false)` — зависимость опциональна. Можно внедрять `Optional<T>`,
`List<T>` (все бины типа), `Map<String,T>` (имя бина → бин).

## @Qualifier

Если бинов одного типа несколько, by-type внедрение неоднозначно (`NoUniqueBeanDefinitionException`).
`@Qualifier("beanName")` уточняет, какой именно бин нужен:
```java
public TaskService(@Qualifier("stubTaskRepository") TaskRepository repo) { ... }
```
Альтернатива — пометить один из бинов `@Primary` (бин по умолчанию при неоднозначности).

## Способы конфигурирования

**XML-based** (исторический):
```xml
<bean id="taskService" class="com.example.TaskService">
    <constructor-arg ref="taskRepository"/>
</bean>
```

**Annotation-based** — сканирование классов со стереотипами:
```java
@Component @Service @Repository @Controller // + @ComponentScan
```

**Java-based** (`@Configuration` + `@Bean`) — программное описание бинов, типобезопасно:
```java
@Configuration
public class AppConfig {
    @Bean
    public TaskService taskService(TaskRepository repo) { return new TaskService(repo); }
}
```
Java-конфигурация удобна для бинов из сторонних библиотек, которые нельзя пометить аннотациями.

## 🔗 Смежные вопросы
- [Б1.1 — Фреймворк, Spring, Spring Boot](/block-1/01-frameworks/)
- [Б1.6 — Жизненный цикл бина](/block-1/06-bean-lifecycle/)
- [Б1.7 — Стереотипы и скоупы](/block-1/07-bean-scopes/)
- [Б1.8 — Аннотации конфигураций](/block-1/08-config-annotations/)

## 📚 Материалы
- [Лонгрид 1 — Введение в Spring Framework](/longreads/01-spring-intro/) — IoC/DI
- [Лонгрид 3 — Стереотипные аннотации и конфигурирование](/longreads/03-stereotypes-config/)
