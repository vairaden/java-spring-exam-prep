---
title: "Лонгрид 5. DispatcherServlet и формирование ответов"
description: "Путь запроса, ResponseEntity, заголовки, CORS"
---

## Содержание
0. Введение и цели лекции
1. DispatcherServlet и путь запроса в Spring MVC
2. Формирование ответов. ResponseEntity
3. ExceptionHandler, ControllerAdvice
4. Кастомные хэдеры в ответах
5. CORS (Cross-Origin Resource Sharing
6. Сервлеты и контейнеры сервлетов
7. OpenAPI + Spring
8. Лучшие практики и заключение
9. FAQ

---

## 0. Введение и цели лекции <a name="введение"></a>

Сегодня мы погрузимся в критически важные аспекты разработки современных веб-приложений на Spring и разберём:
- Как Spring обрабатывает HTTP-запросы и формирует ответы
- Как грамотно обрабатывать исключения в REST API
- Как настраивать кросс-доменные запросы
- Что происходит "под капотом" Spring Boot
- Как документировать ваши API

**Контекст в рамках Spring:**
```java
HTTP Request → Servlet Container → DispatcherServlet → 
→ Handler Mapping → Controller → Response Processing → 
→ HTTP Response
```

---
## **1. DispatcherServlet и путь запроса в Spring MVC

### Что такое DispatcherServlet?

**DispatcherServlet** — это центральный диспетчер всех HTTP-запросов в Spring MVC. Это реализация паттерна "Front Controller", который выступает единой точкой входа для всех запросов.

**Простая аналогия:** Диспетчер в таксопарке:
- Клиенты (запросы) приходят к диспетчеру
- Диспетчер определяет, какой водитель (контроллер) подходит для поездки
- Отправляет клиента к нужному водителю
- Получает результат и отдает клиенту

### Архитектура Spring MVC

```java
┌─────────────────────────────────────────────────────────────┐
│                    HTTP Request                             │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│               DispatcherServlet (Front Controller)          │
└─────────────────┬───────────────────────┬───────────────────┘
                  │                       │
                  ▼                       ▼
        ┌─────────────────┐     ┌───────────────────┐
        │ HandlerMapping  │     │  HandlerAdapter   │
        │ (Находит        │     │ (Выполняет метод  │
        │  контроллер)    │     │  контроллера)     │
        └─────────────────┘     └───────────────────┘
                  │                       │
                  ▼                       ▼
        ┌─────────────────┐     ┌───────────────────┐
        │   Controller    │     │  ViewResolver     │
        │   (Обработчик)  │     │  (Находит view)   │
        └─────────────────┘     └───────────────────┘
                  │                       │
                  ▼                       ▼
        ┌─────────────────────────────────────────┐
        │          ModelAndView                   │
        │   (Модель данных + имя view)           │
        └─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    HTTP Response                            │
└─────────────────────────────────────────────────────────────┘
```

### Полный жизненный цикл запроса:

```java
// 1. Запрос приходит на определенный URL
// 2. DispatcherServlet получает запрос
public class DispatcherServlet extends FrameworkServlet {
    
    protected void doService(HttpServletRequest request, 
                             HttpServletResponse response) {
        // 3. Подготовка контекста запроса
        // 4. Вызов doDispatch() - основной метод
        doDispatch(request, response);
    }
    
    protected void doDispatch(HttpServletRequest request,
                              HttpServletResponse response) {
        
        // 5. Определение Handler (контроллера)
        HandlerExecutionChain mappedHandler = getHandler(request);
        
        // 6. Определение HandlerAdapter
        HandlerAdapter ha = getHandlerAdapter(mappedHandler.getHandler());
        
        // 7. Выполнение интерцепторов (preHandle)
        if (!mappedHandler.applyPreHandle(request, response)) return;
        
        // 8. Вызов метода контроллера
        ModelAndView mv = ha.handle(request, response, 
                                   mappedHandler.getHandler());
        
        // 9. Обработка результата
        applyDefaultViewName(request, mv);
        mappedHandler.applyPostHandle(request, response, mv);
        
        // 10. Рендеринг View
        processDispatchResult(request, response, mappedHandler, mv, null);
    }
}
```

### Создание интерцептора:

```java
@Component
public class LoggingInterceptor implements HandlerInterceptor {
    
    @Override
    public boolean preHandle(HttpServletRequest request, 
                           HttpServletResponse response, 
                           Object handler) {
        // Выполняется ДО контроллера
        log.info("Request: {} {}", 
                 request.getMethod(), 
                 request.getRequestURI());
        
        // Если вернуть false - запрос прерывается
        return true;
    }
    
    @Override
    public void postHandle(HttpServletRequest request, 
                          HttpServletResponse response, 
                          Object handler,
                          ModelAndView modelAndView) {
        // Выполняется ПОСЛЕ контроллера, но до рендеринга
        log.info("Response status: {}", response.getStatus());
    }
    
    @Override
    public void afterCompletion(HttpServletRequest request, 
                               HttpServletResponse response, 
                               Object handler, 
                               Exception ex) {
        // Выполняется ПОСЛЕ завершения запроса
        if (ex != null) {
            log.error("Request failed", ex);
        }
    }
}
```

### Регистрация интерцептора:

```java
@Configuration
public class WebConfig implements WebMvcConfigurer {
    
    @Autowired
    private LoggingInterceptor loggingInterceptor;
    
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(loggingInterceptor)
            .addPathPatterns("/api/**")
            .excludePathPatterns("/api/public/**");
        
        // Добавление нескольких интерцепторов
        registry.addInterceptor(new AuthInterceptor())
            .addPathPatterns("/api/secure/**");
    }
}
```

### Расширение DispatcherServlet:

```java
public class CustomDispatcherServlet extends DispatcherServlet {
    
    @Override
    protected void doDispatch(HttpServletRequest request, 
                             HttpServletResponse response) throws Exception {
        
        long startTime = System.currentTimeMillis();
        
        try {
            // Дополнительная логика перед обработкой
            logRequestDetails(request);
            
            // Стандартная обработка
            super.doDispatch(request, response);
            
        } finally {
            // Логирование после обработки
            long duration = System.currentTimeMillis() - startTime;
            log.info("Request processed in {} ms: {} {}", 
                    duration, request.getMethod(), request.getRequestURI());
        }
    }
    
    @Override
    protected void noHandlerFound(HttpServletRequest request, 
                                 HttpServletResponse response) throws Exception {
        
        // Кастомная обработка 404
        if (request.getServletPath().startsWith("/api/")) {
            response.setStatus(HttpStatus.NOT_FOUND.value());
            response.getWriter().write(
                "{\"error\": \"API endpoint not found\"}"
            );
        } else {
            super.noHandlerFound(request, response);
        }
    }
}
```

### Включение логов DispatcherServlet:

```yaml
logging:
  level:
    org.springframework.web.servlet.DispatcherServlet: DEBUG
    org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping: TRACE
```

### Просмотр зарегистрированных обработчиков:

```java
@RestController
public class DebugController {
    
    @Autowired
    private RequestMappingHandlerMapping handlerMapping;
    
    @GetMapping("/debug/mappings")
    public Map<String, Object> getMappings() {
        Map<String, Object> result = new HashMap<>();
        
        handlerMapping.getHandlerMethods().forEach((info, method) -> {
            result.put(info.toString(), 
                method.getBeanType().getName() + "#" + method.getMethod().getName());
        });
        
        return result;
    }
}
```

### Лучшие практики

### 1. Структурирование контроллеров:

```java
// ❌ ПЛОХО: Все в одном контроллере
@RestController
@RequestMapping("/api")
public class MonolithicController {
    // User методы
    // Product методы
    // Order методы
}

// ✅ ХОРОШО: Разделение по ответственности
@RestController
@RequestMapping("/api/users")
public class UserController { /* ... */ }

@RestController
@RequestMapping("/api/products")
public class ProductController { /* ... */ }

@RestController
@RequestMapping("/api/orders")
public class OrderController { /* ... */ }
```

### 2. Версионирование API:

```java
// Через путь
@RestController
@RequestMapping("/api/v1/users")
public class UserControllerV1 { /* ... */ }

@RestController
@RequestMapping("/api/v2/users")
public class UserControllerV2 { /* ... */ }

// Через заголовок
@RestController
@RequestMapping("/api/users")
public class UserController {
    
    @GetMapping
    public ResponseEntity<?> getUsers(
            @RequestHeader(value = "X-API-Version", 
                          defaultValue = "1") int version) {
        if (version == 1) return getUsersV1();
        else return getUsersV2();
    }
}
```

### Распространенные проблемы и решения

### Проблема 1: Конфликты маппинга
```java
// Неоднозначный маппинг
@GetMapping("/{id}")
public String byId(@PathVariable String id) { /* ... */ }

@GetMapping("/{name}")
public String byName(@PathVariable String name) { /* ... */ }
// ❌ ОШИБКА: Нельзя различить по типу параметра!

// Решение: Разные пути или регулярные выражения
@GetMapping("/id/{id:\\d+}")
public String byId(@PathVariable Long id) { /* ... */ }

@GetMapping("/name/{name:[a-zA-Z]+}")
public String byName(@PathVariable String name) { /* ... */ }
```

### Проблема 2: Потеря trailing slash
```java
// GET /api/users и GET /api/users/ - разные запросы!
@GetMapping("/users")   // Только без слеша
public String getUsers() { /* ... */ }

// Решение: Обрабатывать оба варианта
@GetMapping({"/users", "/users/"})
public String getUsers() { /* ... */ }
```

### Проблема 3: Кодировка параметров
```java
// Параметры с пробелами/кириллицей
@GetMapping("/search")
public String search(@RequestParam String query) {
    // query может быть с проблемами кодировки
}

// Решение: Настроить кодировку
@Bean
public Filter characterEncodingFilter() {
    CharacterEncodingFilter filter = new CharacterEncodingFilter();
    filter.setEncoding("UTF-8");
    filter.setForceEncoding(true);
    return filter;
}
```


DispatcherServlet — это мощный и гибкий механизм Spring MVC, который:

1. **Централизует обработку запросов** через паттерн Front Controller
2. **Поддерживает сложное маппинг URL** на методы контроллеров
3. **Обеспечивает расширяемость** через интерцепторы, конвертеры, хэндлеры
4. **Интегрируется со Spring Boot** для автоматической настройки

**Ключевые моменты для запоминания:**
- DispatcherServlet обрабатывает ВСЕ запросы к приложению
- HandlerMapping находит подходящий контроллер
- HandlerAdapter выполняет метод контроллера
- ViewResolver рендерит результат (для MVC)
- Интерцепторы позволяют добавлять cross-cutting concerns


---
## 2. Формирование ответов. ResponseEntity <a name="responseentity"></a>

### Концепция и предназначение

`ResponseEntity` — это центральный класс для работы с HTTP-ответами в Spring MVC. В отличие от простого возврата объектов (которые автоматически сериализуются в JSON), `ResponseEntity` даёт полный контроль над ответом.

### Основные возможности

```java
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;

@RestController
@RequestMapping("/api/users")
public class UserController {
    
    // 1. Простой ответ с телом и статусом
    @GetMapping("/{id}")
    public ResponseEntity<User> getUser(@PathVariable Long id) {
        User user = userService.findById(id);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(user);
    }
    
    // 2. Ответ с кастомными заголовками
    @PostMapping
    public ResponseEntity<User> createUser(@RequestBody User user) {
        User created = userService.create(user);
        
        URI location = ServletUriComponentsBuilder
            .fromCurrentRequest()
            .path("/{id}")
            .buildAndExpand(created.getId())
            .toUri();
        
        return ResponseEntity
            .created(location)  // статус 201 Created
            .header("X-Custom-Header", "value")
            .body(created);
    }
    
    // 3. Ответ без тела
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable Long id) {
        userService.delete(id);
        return ResponseEntity.noContent().build();  // 204 No Content
    }
    
    // 4. Динамическое определение статуса
    @PutMapping("/{id}")
    public ResponseEntity<User> updateUser(
            @PathVariable Long id, 
            @RequestBody User user) {
        
        try {
            User updated = userService.update(id, user);
            return ResponseEntity.ok(updated);
        } catch (OptimisticLockingFailureException e) {
            // Конфликт версий данных
            return ResponseEntity
                .status(HttpStatus.CONFLICT)
                .body(null);
        }
    }
}
```

### Статические методы фабрики (Spring 5+)

```java
// Вместо new ResponseEntity<>(body, headers, status)
return ResponseEntity.ok(body);                    // 200 OK
return ResponseEntity.created(uri).body(body);     // 201 Created
return ResponseEntity.accepted().body(body);       // 202 Accepted
return ResponseEntity.noContent().build();         // 204 No Content
return ResponseEntity.badRequest().build();        // 400 Bad Request
return ResponseEntity.notFound().build();          // 404 Not Found
return ResponseEntity.internalServerError().build(); // 500
```

### Когда использовать ResponseEntity vs @ResponseBody

**Используйте ResponseEntity, когда нужно:**
- Контролировать HTTP-статус динамически
- Добавлять кастомные заголовки
- Возвращать разные типы контента
- Работать с условными запросами (ETag, Last-Modified)

**Достаточно @ResponseBody или просто возврата объекта, когда:**
- Всегда возвращается 200 OK
- Не нужны дополнительные заголовки
- Достаточно стандартного JSON

---
## 3. ExceptionHandler, ControllerAdvice <a name="exception-handling"></a>

### Проблема без централизованной обработки

```java
// ПЛОХОЙ ПРИМЕР - дублирование в каждом контроллере
@RestController
public class UserController {
    
    @GetMapping("/{id}")
    public User getUser(@PathVariable Long id) {
        try {
            return userService.findById(id);
        } catch (UserNotFoundException e) {
            // Дублируется во всех контроллерах!
            return ResponseEntity.notFound().build();
        } catch (DatabaseException e) {
            // Дублируется во всех контроллерах!
            return ResponseEntity.internalServerError().build();
        }
    }
}
```

### Решение: @ExceptionHandler

```java
@RestController
public class UserController {
    
    // Обработка исключений только в этом контроллере
    @ExceptionHandler(UserNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleUserNotFound(
            UserNotFoundException ex) {
        
        ErrorResponse error = new ErrorResponse(
            "USER_NOT_FOUND",
            ex.getMessage(),
            Instant.now()
        );
        
        return ResponseEntity
            .status(HttpStatus.NOT_FOUND)
            .body(error);
    }
    
    @ExceptionHandler({DatabaseException.class, IOException.class})
    public ResponseEntity<ErrorResponse> handleSystemExceptions(
            Exception ex) {
        
        ErrorResponse error = new ErrorResponse(
            "SYSTEM_ERROR",
            "Internal server error",
            Instant.now()
        );
        
        // Логируем полный стектрейс
        logger.error("System error occurred", ex);
        
        return ResponseEntity
            .status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(error);
    }
}
```

### Глобальная обработка: @ControllerAdvice

```java
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.context.request.WebRequest;

@ControllerAdvice  // Обрабатывает исключения из всех контроллеров
public class GlobalExceptionHandler {
    
    // Стандартизированный формат ошибки
    @Data
    @AllArgsConstructor
    public static class ApiError {
        private String code;
        private String message;
        private Instant timestamp;
        private List<String> details;
    }
    
    // 1. Обработка бизнес-исключений
    @ExceptionHandler({
        UserNotFoundException.class,
        ProductNotFoundException.class
    })
    public ResponseEntity<ApiError> handleNotFound(
            RuntimeException ex, 
            WebRequest request) {
        
        ApiError error = new ApiError(
            "NOT_FOUND",
            ex.getMessage(),
            Instant.now(),
            List.of(request.getDescription(false))
        );
        
        return ResponseEntity
            .status(HttpStatus.NOT_FOUND)
            .body(error);
    }
    
    // 2. Обработка ошибок валидации
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleValidationErrors(
            MethodArgumentNotValidException ex) {
        
        List<String> details = ex.getBindingResult()
            .getFieldErrors()
            .stream()
            .map(error -> error.getField() + ": " + error.getDefaultMessage())
            .collect(Collectors.toList());
        
        ApiError error = new ApiError(
            "VALIDATION_FAILED",
            "Validation failed",
            Instant.now(),
            details
        );
        
        return ResponseEntity
            .status(HttpStatus.BAD_REQUEST)
            .body(error);
    }
    
    // 3. Обработка всех непредвиденных исключений
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleAllUncaught(
            Exception ex, 
            WebRequest request) {
        
        // ВНИМАНИЕ: В production не показывайте stack trace пользователям!
        logger.error("Unhandled exception", ex);
        
        ApiError error = new ApiError(
            "INTERNAL_ERROR",
            "An unexpected error occurred",
            Instant.now(),
            List.of("Please contact support")
        );
        
        return ResponseEntity
            .status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(error);
    }
}
```

### ControllerAdvice с ограничениями

```java
// Обработка только для контроллеров в пакете com.example.api
@ControllerAdvice("com.example.api")
public class ApiExceptionHandler { /* ... */ }

// Обработка только для аннотированных @RestController
@ControllerAdvice(annotations = RestController.class)
public class RestExceptionHandler { /* ... */ }

// Обработка только для конкретных контроллеров
@ControllerAdvice(assignableTypes = {
    UserController.class, 
    ProductController.class
})
public class SpecificExceptionHandler { /* ... */ }
```

### Порядок обработки исключений

1. `@ExceptionHandler` в контроллере
2. `@ControllerAdvice` с ограничениями
3. Глобальный `@ControllerAdvice`
4. Обработчик по умолчанию в Spring

**Совет из практики:** Создайте иерархию исключений:
```java
BaseException → BusinessException → UserNotFoundException
                          ↓
                  ValidationException
```

---

## 4. Кастомные хэдеры в ответах <a name="custom-headers"></a>

### Зачем нужны кастомные заголовки?

1. **Мета-информация**: версия API, время обработки
2. **Пагинация**: общее количество элементов
3. **Кэширование**: токены для инвалидации
4. **Безопасность**: политики, ограничения
5. **Интеграция**: идентификаторы для трассировки

### Способы добавления заголовков

**Способ 1: Через ResponseEntity**
```java
@GetMapping("/search")
public ResponseEntity<List<User>> searchUsers(
        @RequestParam String query,
        HttpServletResponse response) {
    
    List<User> users = userService.search(query);
    
    // Добавляем заголовки через ResponseEntity
    return ResponseEntity.ok()
        .header("X-Total-Count", String.valueOf(users.size()))
        .header("X-API-Version", "v2.1")
        .header("Cache-Control", "max-age=3600")
        .body(users);
}
```

**Способ 2: Через HttpServletResponse**
```java
@GetMapping("/export")
public void exportUsers(
        HttpServletResponse response) throws IOException {
    
    List<User> users = userService.findAll();
    
    // Устанавливаем заголовки напрямую
    response.setHeader("Content-Type", "text/csv");
    response.setHeader("Content-Disposition", 
        "attachment; filename=\"users.csv\"");
    response.setHeader("X-Total-Records", 
        String.valueOf(users.size()));
    
    // Пишем в response напрямую
    try (PrintWriter writer = response.getWriter()) {
        // запись CSV
    }
}
```

**Способ 3: Использование HttpHeaders**
```java
@GetMapping("/custom")
public ResponseEntity<String> customHeaders() {
    
    HttpHeaders headers = new HttpHeaders();
    headers.set("X-Custom-Header", "custom-value");
    headers.setContentType(MediaType.APPLICATION_JSON);
    headers.setDate(Instant.now());
    
    // Добавление нескольких значений для одного заголовка
    headers.add("Set-Cookie", "sessionId=abc123");
    headers.add("Set-Cookie", "language=en");
    
    return new ResponseEntity<>(
        "Response with custom headers", 
        headers, 
        HttpStatus.OK
    );
}
```

### Стандартные заголовки для REST API

```java
// Пример полного набора заголовков для REST API
@PostMapping("/orders")
public ResponseEntity<Order> createOrder(@RequestBody Order order) {
    
    Order created = orderService.create(order);
    URI location = ServletUriComponentsBuilder
        .fromCurrentRequest()
        .path("/{id}")
        .buildAndExpand(created.getId())
        .toUri();
    
    HttpHeaders headers = new HttpHeaders();
    
    // Required by REST standards
    headers.setLocation(location);                           // Location
    headers.setContentType(MediaType.APPLICATION_JSON);      // Content-Type
    
    // Useful for clients
    headers.set("X-RateLimit-Limit", "1000");               // Rate limiting
    headers.set("X-RateLimit-Remaining", "999");            // Rate limiting
    headers.setETag("\"" + created.getVersion() + "\"");     // ETag for caching
    headers.setLastModified(created.getUpdatedAt());         // Last-Modified
    
    // Custom business headers
    headers.set("X-Order-Total", 
        created.getTotal().toString());
    headers.set("X-Order-Currency", 
        created.getCurrency());
    
    return ResponseEntity
        .created(location)
        .headers(headers)
        .body(created);
}
```

**Предупреждение:** Не используйте кастомные заголовки для передачи критичных данных - клиенты могут их игнорировать.

---

## 5. CORS (Cross-Origin Resource Sharing) <a name="cors"></a>

### Проблема Same-Origin Policy

Браузеры запрещают кросс-доменные запросы из соображений безопасности. CORS — механизм, разрешающий такие запросы.
**CORS (Cross-Origin Resource Sharing)** — это механизм безопасности браузеров, который позволяет веб-приложениям, работающим на одном источнике (origin), получать доступ к ресурсам с другого источника, с ограничениями.

**Простая аналогия:** Представьте библиотеку, где у каждого читателя (веб-сайта) есть свой читательский билет (origin). CORS — это правила библиотеки, которые определяют, какие книги (ресурсы) с каких полок (серверов) может брать каждый читатель.

Браузеры по умолчанию запрещают веб-страницам делать запросы к доменам, отличным от того, с которого загружена страница.

Origin = Протокол + Домен + Порт

**Пример:**
- Страница загружена с `https://example.com`
- Скрипт на странице пытается сделать запрос к `https://api.example.com`
- ❌ **Браузер блокирует запрос** (это разные origins!)

### Простой CORS пример

**Frontend (http://localhost:3000):**
```javascript
fetch('http://api.example.com/data', {
    method: 'GET',
    // Браузер автоматически добавляет Origin header
})
.then(response => response.json())
.catch(error => console.error('CORS error:', error));
```

**Без CORS браузер покажет ошибку:**
```java
Access to fetch at 'http://api.example.com/data' from origin 
'http://localhost:3000' has been blocked by CORS policy
```

### Настройка CORS в Spring

**Способ 1: Глобальная конфигурация**
```java
@Configuration
@EnableWebMvc
public class WebConfig implements WebMvcConfigurer {
    
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
            .allowedOrigins(
                "http://localhost:3000",
                "https://frontend.example.com"
            )
            .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
            .allowedHeaders("*")
            .exposedHeaders(
                "X-Total-Count", 
                "X-API-Version"
            )
            .allowCredentials(true)
            .maxAge(3600);  // Кэшировать preflight на 1 час
    }
}
```

**Способ 2: Конфигурация через бин**
```java
@Configuration
public class CorsConfig {
    
    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/**")
                    .allowedOriginPatterns("*")  // Используйте осторожно!
                    .allowedMethods("*")
                    .allowedHeaders("*");
            }
        };
    }
}
```

**Способ 3: Аннотация @CrossOrigin на контроллере**
```java
@RestController
@RequestMapping("/api/users")
@CrossOrigin(
    origins = {"http://localhost:3000", "https://prod-frontend.com"},
    methods = {RequestMethod.GET, RequestMethod.POST},
    allowedHeaders = {"Authorization", "Content-Type"},
    exposedHeaders = {"X-Total-Count"},
    maxAge = 3600
)
public class UserController {
    // Контроллер с CORS
}
```

**Способ 4: Аннотация на методе**
```java
@RestController
public class UserController {
    
    @GetMapping("/public")
    @CrossOrigin(origins = "*")  // Разрешить всем (не рекомендуется для прода)
    public String publicEndpoint() {
        return "Public data";
    }
    
    @GetMapping("/secure")
    @CrossOrigin(origins = "https://trusted-domain.com")
    public String secureEndpoint() {
        return "Secure data";
    }
}
```

### Безопасность CORS

**Ошибки безопасности в production:**

1. **allowedOrigins ("* ") в production** — используйте ` allowedOriginPatterns ` с конкретными доменами
2. **allowCredentials (true) с wildcard origin** — несовместимо
3. **Отсутствие валидации Origin в фильтрах** — всегда проверяйте белый список

**Рекомендации:**
```yaml
cors:
  allowed-origins: 
    - https://frontend.example.com
    - https://admin.example.com
  allowed-methods: GET, POST, PUT, DELETE
  allowed-headers: Authorization, Content-Type
  exposed-headers: X-Total-Count
  allow-credentials: true
  max-age: 3600
```

---

## 6. Понятие сервлета, дефолтный контейнер сервлетов <a name="servlets"></a>

### Что такое сервлет?

**Сервлет** — это Java-класс, обрабатывающий HTTP-запросы и генерирующий HTTP-ответы. Это фундаментальный блок Java веб-приложений.

### Жизненный цикл сервлета

```java
public class SimpleServlet extends HttpServlet {
    
    // 1. Инициализация (один раз)
    @Override
    public void init() throws ServletException {
        System.out.println("Servlet initialized");
    }
    
    // 2. Обработка запросов (многократно)
    @Override
    protected void doGet(
            HttpServletRequest req, 
            HttpServletResponse resp) throws ServletException, IOException {
        
        resp.setContentType("text/html");
        PrintWriter out = resp.getWriter();
        out.println("<h1>Hello from Servlet!</h1>");
    }
    
    // 3. Уничтожение (один раз)
    @Override
    public void destroy() {
        System.out.println("Servlet destroyed");
        // Освобождение ресурсов
    }
}
```

### Spring и сервлеты

Spring MVC построен поверх сервлета `DispatcherServlet`:

```xml
<!-- web.xml (старый стиль) -->
<servlet>
    <servlet-name>dispatcher</servlet-name>
    <servlet-class>
        org.springframework.web.servlet.DispatcherServlet
    </servlet-class>
    <init-param>
        <param-name>contextConfigLocation</param-name>
        <param-value>/WEB-INF/spring-servlet.xml</param-value>
    </init-param>
    <load-on-startup>1</load-on-startup>
</servlet>

<servlet-mapping>
    <servlet-name>dispatcher</servlet-name>
    <url-pattern>/</url-pattern>
</servlet-mapping>
```

**В Spring Boot это настраивается автоматически**

### Контейнеры сервлетов

Контейнер сервлетов — это программа, которая исполняет сервлеты. Основные:

#### 1. Apache Tomcat (дефолтный в Spring Boot)

**Плюсы:**
- Самый популярный, проверенный временем
- Отличная документация
- Легковесный
- Spring Boot имеет отличную интеграцию

**Минусы:**
- Менее производительный для асинхронных задач
- Ограниченные возможности для HTTP/2

**Настройка в Spring Boot:**
```yaml
server:
  tomcat:
    max-connections: 10000
    max-threads: 200
    min-spare-threads: 10
    connection-timeout: 5000ms
    accesslog:
      enabled: true
      directory: ./logs
      pattern: '%t %a "%r" %s (%D ms)'
```

#### 2. Eclipse Jetty

**Плюсы:**
- Отличная производительность для асинхронных операций
- Хорошая поддержка HTTP/2
- Гибкая архитектура

**Минусы:**
- Меньше документации
- Требует более глубоких знаний для настройки

**Подключение в Spring Boot:**
```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
    <exclusions>
        <exclusion>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-tomcat</artifactId>
        </exclusion>
    </exclusions>
</dependency>

<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-jetty</artifactId>
</dependency>
```

#### 3. Undertow (Red Hat)

**Плюсы:**
- Высочайшая производительность
- Очень маленькое потребление памяти
- Встроенная в Spring Boot поддержка

**Минусы:**
- Меньше знаком разработчикам
- Некоторые расширенные функции могут отсутствовать

**Подключение:**
```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
    <exclusions>
        <exclusion>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-tomcat</artifactId>
        </exclusion>
    </exclusions>
</dependency>

<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-undertow</artifactId>
</dependency>
```

#### 4. Netty (не сервлетный контейнер!)

**Важное уточнение:** Netty — это не контейнер сервлетов, а асинхронный сетевой фреймворк. Spring WebFlux использует Netty.

**Плюсы:**
- Максимальная производительность для асинхронных операций
- Отличная масштабируемость
- Поддержка реактивных потоков

**Минусы:**
- Другая парадигма (реактивная)
- Несовместимость с традиционными сервлетами

### Сравнение производительности

```java
Тип нагрузки           Tomcat     Jetty     Undertow
------------           -----     -----     --------
Синхронные запросы     Хорошо    Хорошо    Отлично
Асинхронные            Средне    Хорошо    Отлично
Память                 Средне    Средне    Отлично
Запуск                 Быстро    Быстро    Очень быстро
```

### Как выбрать контейнер?

**Выбирайте Tomcat если:**
- У вас стандартное Spring MVC приложение
- Нужна максимальная совместимость
- Команда знакома с Tomcat

**Выбирайте Jetty если:**
- Много асинхронных операций
- Нужен HTTP/2 с TLS
- Требуется гибкая настройка

**Выбирайте Undertow если:**
- Критична производительность
- Ограничена память
- Приложение высоконагруженное

**Выбирайте Netty если:**
- Используете Spring WebFlux
- Нужна реактивная архитектура
- Обрабатываете тысячи одновременных соединений

---

## 7. OpenAPI + Spring <a name="openapi"></a>

### Что такое OpenAPI?

OpenAPI (он же Swagger) — спецификация для описания REST API. Spring Doc OpenAPI автоматически генерирует документацию из вашего кода.

### Настройка базовой интеграции

**Зависимости:**
```xml
<dependency>
    <groupId>org.springdoc</groupId>
    <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
    <version>2.3.0</version>
</dependency>
```

**Конфигурация:**
```yaml
# application.yml

springdoc:
  api-docs:
    path: /api-docs
  swagger-ui:
    path: /swagger-ui. Html
    operations-sorter: method
    tags-sorter: alpha
    display-request-duration: true
    defaultModelsExpandDepth: 2
  packages-to-scan: com.example.api
  paths-to-match: /api/**
```

### Аннотации для документирования контроллеров

```java 
import io.swagger.v3.oas.annotations.*;
import io.swagger.v3.oas.annotations.media.*;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping("/api/users")
@Tag(
    name = "User Management",
    description = "Operations related to user management"
)
public class UserController {
    
    @Operation(
        summary = "Get user by ID",
        description = "Returns a single user by their unique identifier",
        responses = {
            @ApiResponse(
                responseCode = "200",
                description = "User found",
                content = @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = UserDto.class)
                )
            ),
            @ApiResponse(
                responseCode = "404",
                description = "User not found"
            ),
            @ApiResponse(
                responseCode = "400",
                description = "Invalid ID supplied"
            )
        }
    )
    @GetMapping("/{id}")
    public ResponseEntity<UserDto> getUser(
            @Parameter(
                description = "ID of user to retrieve",
                required = true,
                example = "123"
            )
            @PathVariable Long id) {
        // implementation
    }
    
    @Operation(
        summary = "Create a new user",
        description = "Creates a new user with the provided data"
    )
    @ApiResponses(value = {
        @ApiResponse(
            responseCode = "201",
            description = "User created successfully",
            headers = {
                @Header(
                    name = "Location",
                    description = "URL of the created resource",
                    schema = @Schema(type = "string")
                )
            }
        ),
        @ApiResponse(
            responseCode = "400",
            description = "Invalid input data"
        )
    })
    @PostMapping
    public ResponseEntity<Void> createUser(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                description = "User data to create",
                required = true,
                content = @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = UserCreateDto.class)
                )
            )
            @Valid @RequestBody UserCreateDto userDto) {
        // implementation
    }
    
    @Operation(
        summary = "Search users",
        description = "Search users with pagination and filters"
    )
    @GetMapping("/search")
    public ResponseEntity<Page<UserDto>> searchUsers(
            @Parameter(
                description = "Search query",
                example = "john"
            )
            @RequestParam(required = false) String query,
            
            @Parameter(
                description = "Page number (0-based)",
                example = "0"
            )
            @RequestParam(defaultValue = "0") int page,
            
            @Parameter(
                description = "Page size",
                example = "20"
            )
            @RequestParam(defaultValue = "20") int size,
            
            @Parameter(
                description = "Sort field and direction",
                example = "name,asc"
            )
            @RequestParam(defaultValue = "id,asc") String sort) {
        // implementation
    }
}
```

### Документирование DTO

```java
@Schema(
    description = "User data transfer object",
    requiredProperties = {"email", "password"}
)
@Data
public class UserCreateDto {
    
    @Schema(
        description = "User's email address",
        example = "user@example.com",
        pattern = "^[A-Za-z0-9+_.-]+@(.+)$"
    )
    @Email
    @NotBlank
    private String email;
    
    @Schema(
        description = "User's password",
        example = "SecurePass123!",
        minLength = 8,
        maxLength = 100
    )
    @NotBlank
    @Size(min = 8, max = 100)
    private String password;
    
    @Schema(
        description = "User's full name",
        example = "John Doe",
        maxLength = 100
    )
    @Size(max = 100)
    private String fullName;
    
    @Schema(
        description = "User's role",
        example = "USER",
        allowableValues = {"USER", "ADMIN", "MODERATOR"}
    )
    @Pattern(regexp = "USER|ADMIN|MODERATOR")
    private String role;
}

@Schema(description = "User response DTO")
@Data
public class UserDto {
    
    @Schema(
        description = "Unique identifier",
        example = "123",
        accessMode = Schema.AccessMode.READ_ONLY
    )
    private Long id;
    
    @Schema(
        description = "User's email address",
        example = "user@example.com"
    )
    private String email;
    
    @Schema(
        description = "User's full name",
        example = "John Doe"
    )
    private String fullName;
    
    @Schema(
        description = "Registration date",
        example = "2024-01-15T10:30:00Z",
        type = "string",
        format = "date-time"
    )
    private Instant registeredAt;
}
```

### Кастомизация OpenAPI

```java
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.*;
import io.swagger.v3.oas.models.security.*;
import io.swagger.v3.oas.models.servers.Server;

@Configuration
public class OpenApiConfig {
    
    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
            .info(new Info()
                .title("User Management API")
                .version("1.0.0")
                .description("API for managing users in the system")
                .termsOfService("https://example.com/terms")
                .contact(new Contact()
                    .name("API Support")
                    .email("support@example.com")
                    .url("https://example.com/contact"))
                .license(new License()
                    .name("Apache 2.0")
                    .url("https://www.apache.org/licenses/LICENSE-2.0")))
            .addSecurityItem(new SecurityRequirement()
                .addList("Bearer Authentication"))
            .components(new Components()
                .addSecuritySchemes("Bearer Authentication", 
                    new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("JWT")))
            .addServersItem(new Server()
                .url("https://api.example.com")
                .description("Production server"))
            .addServersItem(new Server()
                .url("http://localhost:8080")
                .description("Local development server"))
            .externalDocs(new ExternalDocumentation()
                .description("API Documentation Wiki")
                .url("https://wiki.example.com/api-docs"));
    }
}
```

### Глобальные настройки ответов

```java
@Configuration
public class OpenApiResponseConfig {
    
    @Bean
    public OpenApiCustomiser globalOpenApiCustomiser() {
        return openApi -> openApi
            .getPaths().values().forEach(pathItem ->
                pathItem.readOperations().forEach(operation -> {
                    
                    // Добавляем общие ответы ошибок
                    operation.getResponses().addApiResponse("400",
                        new ApiResponse()
                            .description("Bad Request")
                            .content(new Content().addMediaType(
                                MediaType.APPLICATION_JSON_VALUE,
                                new io.swagger.v3.oas.models.media.MediaType()
                                    .schema(new Schema<ErrorResponse>()
                                        .$ref("#/components/schemas/ErrorResponse")))));
                    
                    operation.getResponses().addApiResponse("401",
                        new ApiResponse()
                            .description("Unauthorized"));
                    
                    operation.getResponses().addApiResponse("500",
                        new ApiResponse()
                            .description("Internal Server Error"));
                })
            );
    }
}
```

### Генерация клиентов на основе OpenAPI

**Использование OpenAPI Generator:**

```yaml
# Openapi-generator-config. Yaml
GeneratorName: java
Library: webclient
ApiPackage: com. Example. Client. Api
ModelPackage: com. Example. Client. Model
InvokerPackage: com. Example. Client
GroupId: com. Example
ArtifactId: api-client
ArtifactVersion: 1.0.0
```

```bash
# Генерация клиента
Openapi-generator-cli generate \
  -i http://localhost:8080/v3/api-docs \
  -g java \
  -c openapi-generator-config. Yaml \
  -o ./api-client
```

### Лучшие практики документирования

1. **Всегда документируйте:**
   - Коды ответов
   - Параметры запроса
   - Тело запроса/ответа
   - Возможные ошибки

2. **Используйте примеры (examples):**
   ```java
@Schema(
       description = "Order status",
       example = "PROCESSING",
       allowableValues = {
           "NEW", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"
       }
   )
   private String status;
   ```java

3. **Группируйте операции по тегам:**
   ```java
   @Tag(name = "Admin Operations", description = "Admin only endpoints")
   @PreAuthorize("hasRole('ADMIN')")
   @RestController
   @RequestMapping("/admin")
   public class AdminController { /* ... */ }
   ```

4. **Документируйте security требования:**
   ```java
   @Tag(name = "Admin Operations", description = "Admin only endpoints")
   @PreAuthorize("hasRole('ADMIN')")
   @RestController
   @RequestMapping("/admin")
   public class AdminController { /* ... */ }
   ```

---

## 8. Лучшие практики и заключение <a name="best-practices"></a>

### Сводка лучших практик

1. **ResponseEntity:**
   - Используйте для полного контроля над ответами
   - Применяйте статические методы для читаемости
   - Возвращайте правильные HTTP-статусы

2. **Обработка исключений:**
   - Используйте @ControllerAdvice для глобальной обработки
   - Не раскрывайте внутренние детали ошибок
   - Логируйте полные stack trace для администраторов

3. **CORS:**
   - Никогда не используйте allowedOrigins ("\*") в production
   - Настройте белый список доменов

4. **Контейнеры сервлетов:**
   - Tomcat для большинства случаев
   - Undertow для максимальной производительности
   - Jetty для асинхронных операций
   - Netty только с WebFlux

5. **OpenAPI:**
   - Документируйте все публичные endpoint
   - Используйте аннотации в коде
   - Поддерживайте документацию актуальной

### Типичные ошибки новичков

1. **Возврат ResponseEntity с null телом** — всегда возвращайте явные статусы
2. **Отсутствие обработки исключений** — все исключения должны быть обработаны
3. **Слишком открытый CORS** — безопасность прежде всего
4. **Недостаточная настройка Tomcat** — настройте пулы потоков
5. **Отсутствие документации API** — документируйте как для внешних разработчиков

### Рекомендуемая литература

1. "Spring in Action" - Craig Walls
2. "Pro Spring MVC with WebFlux" - Iuliana Cosmina
3. "HTTP: The Definitive Guide" - David Gourley
4. Официальная документация Spring и Tomcat/Jetty/Undertow

---

## 9. FAQ (Часто задаваемые вопросы) <a name="faq"></a>

**Q1: Когда использовать ResponseEntity, а когда достаточно @ResponseBody?**  
A: Используйте ResponseEntity, когда нужен контроль над статусом или заголовками. Для простых GET-запросов с кодом 200 OK достаточно @ResponseBody.

**Q2: Какой контейнер сервлетов самый быстрый?**  
A: В синхронных сценариях Undertow показывает лучшую производительность. Однако "самый быстрый" зависит от конкретного use case.

**Q3: Можно ли использовать несколько @ControllerAdvice?**  
A: Да, можно. Spring обрабатывает их в порядке, определенном @Order. Будьте осторожны с перекрывающимися @ExceptionHandler.

**Q4: Как документировать файловые upload endpoint в OpenAPI?**  
A: Используйте @Parameter с content = @Content (mediaType = "multipart/form-data").

**Q5: Почему CORS ошибки происходят только в браузере?**  
A: Браузеры применяют Same-Origin Policy. Инструменты вроде curl или Postman не имеют этих ограничений.

**Q6: Можно ли изменить формат ошибок в @ControllerAdvice?**  
A: Да, полностью контролируйте формат в методе, возвращая любой DTO.

**Q7: Как документировать deprecated endpoint в OpenAPI?**  
A: Используйте @Deprecated на методе и @Operation (deprecated = true).

**Q8: Как обрабатывать кастомные заголовки на клиенте?**  
A: В JavaScript используйте response.Headers.Get ('X-Custom-Header').

**Q9: Когда использовать Netty вместо Tomcat?**  
A: Только при использовании Spring WebFlux для реактивного программирования.



