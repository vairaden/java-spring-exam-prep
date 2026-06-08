---
title: "18. Тестирование Spring-приложений"
description: "Unit/интеграционное/E2E, @SpringBootTest, @WebMvcTest, @MockBean, @SpyBean, MockMvc, Testcontainers"
---

> Тестирование. Unit-тестирование. Интеграционное тестирование. E2E-тестирование. @SpringBootTest, @WebMvcTest, @MockBean, @SpyBean, MockMvc. Testcontainers.

## Пирамида тестирования

- **Unit** — изолированно проверяют один класс; зависимости — моки (Mockito). Быстрые,
  многочисленные. **Без поднятия Spring-контекста.**
- **Интеграционные** — проверяют взаимодействие компонентов (слой web↔service↔repository, БД).
  Поднимается часть/весь контекст.
- **E2E** — проверяют систему целиком через реальный API/БД, как пользователь.

## Unit-тест (без Spring)

```java
@ExtendWith(MockitoExtension.class)
class TaskServiceTest {
    @Mock TaskRepository repo;
    @InjectMocks TaskService service;

    @Test void createsTask() {
        when(repo.save(any())).thenReturn(new Task(1L, "t"));
        assertEquals(1L, service.create("t").id());
        verify(repo).save(any());
    }
}
```

## @WebMvcTest — срез веб-слоя

Поднимает **только** MVC-инфраструктуру (контроллеры, конвертеры, валидацию), без service/
repository. Сервисы подменяются моками. Быстрее, чем `@SpringBootTest`:
```java
@WebMvcTest(TaskController.class)
class TaskControllerTest {
    @Autowired MockMvc mvc;
    @MockBean TaskService service;       // мок в контексте вместо реального бина

    @Test void getReturns200() throws Exception {
        when(service.get(1L)).thenReturn(new TaskResponseDto(1L, "t"));
        mvc.perform(get("/api/tasks/1"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.title").value("t"));
    }
}
```

## MockMvc

Инструмент для тестирования контроллеров **без реального HTTP-сервера** — запрос проходит
через `DispatcherServlet` в памяти. Позволяет проверять статус, заголовки, тело
(`jsonPath`), и комбинируется с `@WebMvcTest` или `@SpringBootTest`.

## @SpringBootTest — полный контекст

Поднимает **весь** контекст приложения. Для интеграционных/E2E тестов:
```java
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
class TaskE2ETest {
    @Autowired TestRestTemplate rest;     // реальные HTTP-запросы к поднятому серверу
}
```
`webEnvironment`: `MOCK` (по умолчанию, с MockMvc), `RANDOM_PORT`/`DEFINED_PORT` (реальный сервер).

## @MockBean vs @SpyBean

- **`@MockBean`** — заменяет бин в контексте **полным моком** (все методы — заглушки).
- **`@SpyBean`** — оборачивает **реальный** бин шпионом: по умолчанию вызывает настоящие
  методы, но позволяет частично замокать и **верифицировать** вызовы.

(В новых версиях Spring Boot 3.4+ они помечены deprecated в пользу `@MockitoBean`/
`@MockitoSpyBean`, семантика та же.)

## Testcontainers

Поднимает **реальные зависимости в Docker-контейнерах** (PostgreSQL, Kafka, Redis) на время
теста — близко к проду, без моков БД:
```java
@SpringBootTest
@Testcontainers
class RepositoryIntegrationTest {
    @Container
    static PostgreSQLContainer<?> db = new PostgreSQLContainer<>("postgres:16");

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", db::getJdbcUrl);
        r.add("spring.datasource.username", db::getUsername);
        r.add("spring.datasource.password", db::getPassword);
    }
}
```
Плюсы: тестируем на той же СУБД, что в проде (а не H2); контейнер изолирован и
автоматически удаляется. Минус — нужен Docker и время на старт.

## 🔗 Смежные вопросы
- [Б1.3 — Архитектуры приложения (тестируемость)](/block-1/03-architectures/)
- [Б1.13 — Контроллеры, DTO, валидация](/block-1/13-controllers-dto/)
- [Б2.5 — JPA и Hibernate (Testcontainers + БД)](/block-2/05-jpa-hibernate/)

## 📚 Материалы
- [Лонгрид 11 — Тестирование Spring-приложений](/longreads/11-testing/)
