---
title: "Лонгрид 4. Spring MVC и RESTful-сервисы"
description: "Контроллеры, DTO, валидация, обработка ошибок"
---

**Цель сегодняшней лекции**: мы с тобой погрузимся в «кухню» Spring MVC и RESTful-сервисов. Ты не просто узнаешь, какие аннотации куда ставить, а поймёшь, *как это работает внутри*, как правильно структурировать код и, что самое важное, какие ошибки чаще всего допускают новички и как их избежать. Эта лекция — ключевой кирпич в изучении Spring. Мы находимся на уровне **Web Layer** в классической трёхслойной архитектуре (Web → Service → Repository).

**Содержание лекции**
1.  Обработка запросов: `@Controller`, `@RestController`, `@RequestMapping`, `@RequestBody`, `@ResponseBody`, `@PathVariable`, `@RequestParam`
2.  Понятие DTO. Маппинг DTO на Entity
3.  Загрузка файлов: `raw` и `MultipartFile`
4.  Работа с состоянием: заголовки, куки, сессии
5. Валидация на уровне контроллеров
6. Лучшие практики и итоги

---

# **Часть 1: обработка запросов — сердце Spring MVC**

**Логика**: Spring MVC предлагает декларативную модель. Ты объявляешь, *что* хочешь получить (параметр, тело запроса, часть пути), а фреймворк знает, *как* это сделать.
## **1.1. `@Controller` vs `@RestController`**
*   **`@Controller`** — классический контроллер Spring MVC, предназначенный для возврата **имён представлений (View names)**, которые резолвятся в HTML-страницы (через Thymeleaf, JSP). Он является потомком `@Component`.
*   **`@RestController`** — это комбинация `@Controller` + `@ResponseBody` на уровне класса. **Ключевое отличие** — все методы по умолчанию возвращают данные (JSON/XML), а не имена представлений. Это основа для REST API.
    ```java
    @Controller
    public class OldWebController {
        @GetMapping("/page")
        public String showPage(Model model) {
            model.addAttribute("message", "Hello");
            return "page-view-name"; // Ресолвится в /WEB-INF/views/page-view-name.jsp
        }
    }

    @RestController
    @RequestMapping("/api/users")
    public class UserApiController {
        // Все методы будут возвращать JSON
    }
    ```

## **1.2. `@RequestMapping` и HTTP-методы**
Базовая аннотация для маппинга запросов на методы. Задает URL, метод, consumes-/produces-типы.
*   **Специализированные аннотации (лучшая практика)**: `@GetMapping`, `@PostMapping`, `@PutMapping`, `@DeleteMapping`, `@PatchMapping`. Они читабельнее и безопаснее.
    ```java
    // Устаревший, но рабочий вариант
    @RequestMapping(value = "/users", method = RequestMethod.GET)
    // Современный и предпочтительный
    @GetMapping("/users")
    ```

## **1.3. Извлечение данных из запроса**

- **`@PathVariable`** — для извлечения данных из **пути (path)** URL.
```java
@GetMapping("/users/{id}")
public UserDto getUser(@PathVariable Long id) { // Имена совпадают
    // Запрос: GET /api/users/42 -> id = 42
    return userService.findById(id);
}

@GetMapping("/posts/{postId}/comments/{commentId}")
public CommentDto getComment(
        @PathVariable Long postId,
        @PathVariable("commentId") Long id) { // Можно явно указать имя
    // ...
}
```
**Ошибка**: `MissingPathVariableException` — если в аннотации метода указан `{id}`, а в запросе его нет.

- **`@RequestParam`** — для извлечения данных из **строки запроса (query string)**.
```java
@GetMapping("/users/search")
public List<UserDto> searchUsers(
        @RequestParam String name,
        @RequestParam(required = false, defaultValue = "0") int page) {
    // Запрос: GET /api/users/search?name=Alex&page=2
    // required = false — параметр необязательный
    // defaultValue — значение, если параметр не передан или пустой
    return userService.search(name, page);
}
```
**Ошибка**: `MissingServletRequestParameterException` — если `required=true` (по умолчанию), а параметра нет.  
**Совет**: для сложной фильтрации используй DTO-объект (Spring автоматически свяжет поля) с `@Valid`.

- **`@RequestBody` и `@ResponseBody`.**

  **`@RequestBody`** указывает, что параметр метода должен быть **связан с телом HTTP-запроса**. Spring использует `HttpMessageConverter` (например, `MappingJackson2HttpMessageConverter` для JSON) для преобразования тела в объект Java.
    ```java
    @PostMapping("/users")
    public ResponseEntity<UserDto> createUser(@RequestBody @Valid UserCreateDto createDto) {
        // Spring пытается конвертировать JSON типа {"name":"Alex", "email":"a@b.c"} в UserCreateDto
        UserDto saved = userService.create(createDto);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }
    ```
  **Ошибка:** `HttpMessageNotReadableException`, если тело запроса — невалидный JSON или не соответствует структуре DTO.

  **`@ResponseBody`** указывает, что возвращаемое значение метода должно быть **записано в тело HTTP-ответа**. В `@RestController` проставлена по умолчанию.
    ```java
    @Controller
    public class HybridController {
        @ResponseBody // Без этой аннотации Spring будет искать view с именем "userDto"
        @GetMapping("/api/data")
        public UserDto getData() {
            return new UserDto(...);
        }
    }
    ```

**Зависимости для работы с JSON (обязательные)**
```xml
<!-- Для Spring Boot -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId> <!-- Включает Jackson -->
</dependency>

<!-- Для чистого Spring MVC -->
<dependency>
    <groupId>com.fasterxml.jackson.core</groupId>
    <artifactId>jackson-databind</artifactId>
</dependency>
```

---

# **Часть 2: DTO (Data Transfer Object) — обязательный паттерн**

**Проблема**: почему нельзя использовать Entity (JPA-сущность для БД) в контроллерах?
-  **Нарушение слоёв.** Entity — часть слоя данных. Контроллеру не нужно знать про JPA-аннотации (`@OneToMany`).
-  **Избыточные/недостающие данные.** API может требовать иной набор полей (например, пароль только для создания, но не для чтения).
-  **Циклические ссылки.** `User` → `List<Order>` → `Order` → `User`. При сериализации в JSON получим бесконечную рекурсию.

**Решение**: DTO — простой POJO-объект для передачи данных между клиентом и сервером.

**Пример:**
```java
// Entity (JPA)
@Entity
public class User {
    @Id
    @GeneratedValue
    private Long id;
    private String username;
    private String passwordHash;
    @OneToMany(mappedBy = "user")
    private List<Order> orders;
    // …геттеры/сеттеры
}

// DTO для создания пользователя (запрос)
public class UserCreateDto {
    @NotBlank
    private String username;
    @NotBlank @Email
    private String email;
    @Size(min = 8)
    private String password;
    // …только необходимые поля
}

// DTO для ответа (без пароля)
public class UserDto {
    private Long id;
    private String username;
    private String email;
    // …только необходимые поля
}
```

**Маппинг DTO <-> Entity**

**Никогда не делай это вручную в цикле!** Это скучно и подвержено ошибкам.

**Используй библиотеки:**
-  **MapStruct (рекомендуется).** Генерирует код на этапе компиляции — максимальная производительность;

     ```java
        @Mapper(componentModel = "spring")
        public interface UserMapper {
            UserDto toDto(User user);
            User fromCreateDto(UserCreateDto dto);
        }
        // Использование в сервисе: userMapper.toDto(userEntity);
     ```
-  **ModelMapper.** Рефлексивный маппер, проще, но медленнее.

**Зависимость для MapStruct:**

 ```xml
    <dependency>
        <groupId>org.mapstruct</groupId>
        <artifactId>mapstruct</artifactId>
        <version>1.5.5.Final</version>
    </dependency>
    <dependency>
        <groupId>org.mapstruct</groupId>
        <artifactId>mapstruct-processor</artifactId>
        <version>1.5.5.Final</version>
        <scope>provided</scope>
    </dependency>
 ```

---

# **Часть 3: загрузка файлов — `raw` и `MultipartFile`**

## 3.1. Целые файлы

**Ключевое отличие от Multipart**: при работе с raw-файлами ты получаешь полный контроль над потоком, но и полную ответственность за обработку ошибок, безопасность и освобождение ресурсов. Всегда используй try-with-resources для InputStream/OutputStream и реализуй валидации/метрики на уровне приложения.

**1. Чтение InputStream напрямую из HttpServletRequest**

Это самый низкоуровневый и контролируемый способ.

```java
@RestController
@RequestMapping("/api/raw/files")
public class RawFileUploadController {
    @PostMapping(value = "/upload-stream", consumes = MediaType.APPLICATION_OCTET_STREAM_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ResponseEntity<FileUploadResponse> uploadRawStream(HttpServletRequest request) 
            throws IOException {
        
        // 1. Получаем информацию из заголовков
        String contentType = request.getContentType();
        long contentLength = request.getContentLengthLong(); // Может быть −1
        
        // 2. Генерируем безопасное имя файла на основе заголовков или таймстампа
        String originalFileName = request.getHeader("X-File-Name");
        String safeFileName = (originalFileName != null) 
                ? generateSafeFileName(originalFileName) 
                : "upload-" + System.currentTimeMillis() + ".bin";
        
        // 3. Создаём путь для сохранения
        Path uploadPath = Paths.get("/storage/uploads").resolve(safeFileName);
        Files.createDirectories(uploadPath.getParent());
        
        // 4. Копируем поток напрямую в файл (не загружая в память)
        long bytesCopied;
        try (InputStream inputStream = request.getInputStream();
             OutputStream outputStream = Files.newOutputStream(uploadPath, StandardOpenOption.CREATE_NEW)) {
            
            bytesCopied = inputStream.transferTo(outputStream);
        
        }
        
        // 5. Возвращаем результат
        return ResponseEntity.ok(FileUploadResponse.builder()
                .filename(safeFileName)
                .originalFilename(originalFileName)
                .size(bytesCopied)
                .location(uploadPath.toString())
                .build());
    }
}
```

**2. Чтение файла в `byte[]` (для небольших файлов)**

```java
@PostMapping(value = "/upload-bytes", consumes = MediaType.APPLICATION_OCTET_STREAM_VALUE)
public ResponseEntity<?> uploadAsBytes(@RequestBody byte[] fileBytes,
                                      @RequestHeader("X-File-Name") String fileName) {
    
    if (fileBytes.length > 10 * 1024 * 1024) { // 10 MB лимит
        return ResponseEntity.badRequest()
                .body("File too large. Max size is 10MB");
    }
    
    // Обработка файла из памяти
    String fileHash = DigestUtils.md5DigestAsHex(fileBytes);
    
    return ResponseEntity.ok(Map.of(
        "filename", fileName,
        "size", fileBytes.length,
        "hash", fileHash
    ));
}
```
## 3.2. Multipart

Веб-загрузка файлов работает через стандарт **`multipart/form-data`** (RFC 7578). Spring абстрагирует низкоуровневую работу с частями (parts) через интерфейс **`MultipartFile`**.

**Настройка (application. Yml)**
```yaml
spring:
  servlet:
    multipart:
      max-file-size: 10MB       # Макс. размер одного файла
      max-request-size: 25MB    # Макс. размер всего запроса (файлы + данные)
      enabled: true
      file-size-threshold: 2KB  # Файлы меньше этого размера хранятся в памяти, большие — на диске во временной папке
```

**Простейший контроллер для одного файла**
```java
@RestController
@RequestMapping("/api/files")
@Slf4j
public class FileUploadController {

    @PostMapping("/upload-simple")
    public ResponseEntity<UploadResponse> uploadSimple(
            @RequestParam("file") MultipartFile file) { // "file" — имя поля в форме

        // 1. Базовая валидация
        if (file.isEmpty()) {
            throw new ValidationException("File is empty");
        }

        // 2. Вызов сервиса для обработки
        String fileId = fileStorageService.store(file);

        // 3. Формирование ответа
        return ResponseEntity.ok(new UploadResponse(fileId, "File uploaded successfully"));
    }
}
```

**Потоковая обработка больших файлов (чтобы не держать весь файл в памяти)**
```java
@Service
public class StreamFileStorageService {

    public String storeLargeFile(MultipartFile file) throws IOException {
        String originalFilename = file.getOriginalFilename();
        String safeFilename = generateSafeFilename(originalFilename); // Важно!

        Path targetLocation = Paths.get("/storage/uploads").resolve(safeFilename);

        // Копируем поток файла напрямую в файловую систему
        try (InputStream inputStream = file.getInputStream()) {
            Files.copy(inputStream, targetLocation, StandardCopyOption.REPLACE_EXISTING);
        }

        return safeFilename;
    }
}
```

### Выдача (скачивание) файлов

**1. Прямая выдача через `Resource` (для локальных файлов)**
```java
@GetMapping("/download/{filename:.+}")
public ResponseEntity<Resource> downloadFile(@PathVariable String filename) {
    Resource resource = fileStorageService.loadAsResource(filename);

    return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION,
                    "attachment; filename=\"" + resource.getFilename() + "\"")
            .contentType(MediaType.APPLICATION_OCTET_STREAM)
            .body(resource);
}
```
**Проблема**: сервер выступает прокси, нагружается трафиком.

**2. Редирект на прямой URL (лучший способ для S3/CDN)**
```java
@GetMapping("/file/{fileId}/url")
public ResponseEntity<RedirectResponse> getFileUrl(@PathVariable String fileId) {
    String directUrl = fileStorageService.generatePresignedUrl(fileId);
    // Возвращаем клиенту URL, он скачивает напрямую с S3
    return ResponseEntity.ok(new RedirectResponse(directUrl));
}
```

### Типичные ошибки и подводные камни
**Главное правило, которое нужно запомнить**: контроллер, получающий файл, **не должен заниматься бизнес-логикой обработки файла**. Его задача — принять файл, провести минимальную валидацию и передать его сервису. Сервис уже решает, куда и как сохранить файл.

**Подводные камни**

-  **Размер файла.** Всегда проверяй `file.isEmpty()` и настраивай лимиты.
-  **Безопасность.** Проверяй расширение и MIME-тип, не доверяй `originalFilename`. Сохраняй файлы под новым, сгенерированным именем.
-  **Производительность.** Большие файлы могут «съесть» память. Для потоковой обработки используй `InputStream` из `file.getInputStream()`.


1.  **Ошибка `MultipartException: Current request is not a multipart request`**
    *   **Причина**: клиент не установил заголовок `Content-Type: multipart/form-data` или неверно сформировал границы (boundary).
    *   **Решение**: проверяй формирование запроса на клиенте. Используй готовые библиотеки (axios, Fetch API с FormData).

2.  **Ошибка `FileSizeLimitExceededException` после настройки лимитов**
    *   **Причина**: в Spring Boot до 2. X-лимиты также нужно настраивать для embedded Tomcat отдельно (`server.tomcat.max-swallow-size`).
    *   **Решение**: в современных версиях достаточно настроек `spring.servlet.multipart.*`.

3.  **Утечка ресурсов (открытые потоки)**
    *   **Причина**: не закрываются `InputStream` от `MultipartFile`.
    *   **Решение**: всегда используй try-with-resources или доверяй Spring (в большинстве случаев он закроет поток сам, но лучше перестраховаться).

4.  **Забивание диска временными файлами**
    *   **Причина**: Spring сохраняет большие файлы во временную директорию ОС, которая не чистится автоматически.
    *   **Решение**: настрой свою временную директорию и периодически чисти старые файлы (например, cron-задачей).

### Тестирование

**Юнит-тест сервиса (с Mock-объектом MultipartFile)**
```java
@Test
void shouldStoreFileSuccessfully() throws IOException {
    MultipartFile mockFile = mock(MultipartFile.class);
    when(mockFile.getOriginalFilename()).thenReturn("test.jpg");
    when(mockFile.getInputStream()).thenReturn(new ByteArrayInputStream("test data".getBytes()));

    String fileId = storageService.store(mockFile);
    assertThat(fileId).isNotNull();
}
```

**Интеграционный тест контроллера с `@SpringBootTest` и `MockMvc`**
```java
@Test
void shouldUploadFile() throws Exception {
    MockMultipartFile file = new MockMultipartFile(
            "file",
            "hello.txt",
            MediaType.TEXT_PLAIN_VALUE,
            "Hello, World!".getBytes()
    );

    mockMvc.perform(multipart("/api/files/upload").file(file))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.fileId").exists());
}
```

### Итоговый совет

Выстрой **чёткий конвейер обработки файла**.
1.  **Контроллер** принимает → проверяет размер и пустоту → передаёт в сервис.
2.  **Сервис валидации** проверяет MIME-тип, «магические числа», имя файла → генерирует безопасное имя.
3.  **Сервис хранения** сохраняет в выбранное хранилище (локальное/S3) → возвращает идентификатор.
4.  **Сервис метаданных** сохраняет запись в БД (id, оригинальное имя, размер, тип, ссылку в хранилище, owner_id).

**Всегда храни метаданные файла в БД, а сам файл — во внешнем хранилище.** Это даст возможность строить сложные запросы (найти все файлы пользователя, удалить устаревшие) без ковыряния в файловой системе.

---

# **Часть 4: работа с заголовками, куки и сессиями**

## **4.1. Работа с куки**

**Что это**: маленький фрагмент данных (до 4 KB), который **сервер отправляет браузеру**, а браузер хранит и автоматически отправляет обратно с каждым следующим запросом на тот же домен.

**Простыми словами**: это **записка от сервера браузеру**, которую браузер показывает серверу при каждом визите.

- **Хранится**: в браузере пользователя (на его компьютере).
- **Пример**: `sessionId=abc123; theme=dark; cartItems=3`.
- **Аналогия**: пропуск с твоим именем и номером. Ты показываешь его на входе, но в самом пропуске нет подробностей о тебе — только идентификатор.
  Куки — это данные **на стороне клиента**. Они уязвимы к подделке (XSS, CSRF), поэтому критически важно правильно их настраивать.

### 4.2.1. Чтение кук в контроллере

Используется аннотация `@CookieValue`. Она извлекает значение конкретной куки из запроса.

```java
@GetMapping("/dashboard")
public String dashboard(@CookieValue(value = "userToken", defaultValue = "") String token) {
    if (token.isEmpty()) {
        return "redirect:/login"; // Нет токена — нет доступа
    }
    // Верификация токена…
    return "dashboard";
}
```

**Важно**: `defaultValue` позволяет обрабатывать случаи, когда куки нет. `required = false` делает параметр необязательным (тогда токен может быть `null`).

### **4.2.2. Установка кук в ответе**

Использовать `ResponseCookie` и `ResponseEntity`.
```java
@PostMapping("/login")
public ResponseEntity<UserAuthResponse> login(@RequestBody LoginRequest request,
                                              HttpServletResponse response) {
    // …аутентификация пользователя
    String authToken = generateSecureToken();

    ResponseCookie cookie = ResponseCookie.from("authToken", authToken) // имя, значение
            .httpOnly(true)  // 1. ЗАПРЕТИТЬ доступ из JavaScript (защита от XSS)
            .secure(true)    // 2. Передавать ТОЛЬКО по HTTPS (в продакшене)
            .path("/")       // 3. Действует для всего сайта
            .maxAge(Duration.ofDays(7)) // 4. Время жизни (сек.) 0 = удалить
            .sameSite("Strict") // 5. Защита от CSRF-атак (Strict, Lax, None)
            .build();

    return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, cookie.toString()) // Устанавливаем куку
            .body(new UserAuthResponse(user));
}
```

### **4.2.3. Удаление куки**
Чтобы удалить куку у клиента, нужно отправить куку с тем же именем, путём и доменом, но с `maxAge = 0`.
```java
@PostMapping("/logout")
public ResponseEntity<Void> logout() {
    ResponseCookie deleteCookie = ResponseCookie.from("authToken", "")
            .httpOnly(true)
            .secure(true)
            .path("/")
            .maxAge(0) // Ключевой момент
            .sameSite("Strict")
            .build();

    return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, deleteCookie.toString())
            .build();
}
```

## **4.2. Работа с сессиями**

**Что это**: **объект на сервере**, где хранятся данные пользователя между запросами. Клиенту передаётся только **ID сессии (обычно в куке с именем `JSESSIONID`)**.

**Простыми словами**: это **папка с делами на сервере**, доступ к которой даёт специальный пропуск (кука с ID).
- **Хранится**: в памяти сервера, базе данных или Redis.
- **Пример**: в папке с ID `abc123` лежат данные: `{userId: 42, cart: [товар1, товар2], loginTime: 14:30}`.
- **Аналогия**: камера хранения. Тебе дают номерок (кука), по которому на складе (сервере) хранится твой чемодан с вещами (данные сессии).

Сессия — **stateful-механизм на стороне сервера**. Она создаётся при первом запросе от клиента, если её не было.

**Доступ к сессии** — через параметр метода.

```java
    @PostMapping("/login")
    public String login(UserLoginDto dto, HttpSession session) {
        if (authenticate(dto)) {
            session.setAttribute("currentUser", dto.getUsername());
            // Установка времени жизни сессии в секундах
            session.setMaxInactiveInterval(30 * 60); // 30 минут
            return "redirect:/dashboard";
        }
        return "login";
    }

    @GetMapping("/dashboard")
    public String dashboard(HttpSession session) {
        String user = (String) session.getAttribute("currentUser");
        if (user == null) {
            return "redirect:/login";
        }
        return "dashboard";
    }

    @GetMapping("/logout")
    public String logout(HttpSession session) {
        session.invalidate(); // Уничтожение сессии
        return "redirect:/login";
    }
    
```
### **4.3.1. Основные операции с `HttpSession`**
```java
@RestController
@RequestMapping("/cart")
public class ShoppingCartController {

    @PostMapping("/add")
    public String addItem(@RequestParam Long itemId, HttpSession session) {
        // 1. Получаем или создаём корзину как атрибут сессии
        List<Long> cart = (List<Long>) session.getAttribute("userCart");
        if (cart == null) {
            cart = new ArrayList<>();
            session.setAttribute("userCart", cart);
        }

        // 2. Работаем с данными сессии
        cart.add(itemId);

        // 3. Устанавливаем таймаут бездействия (в секундах)
        session.setMaxInactiveInterval(30 * 60); // 30 минут

        return "Item added. Cart size: " + cart.size();
    }

    @GetMapping("/view")
    public List<Long> viewCart(HttpSession session) {
        List<Long> cart = (List<Long>) session.getAttribute("userCart");
        return cart != null ? cart : Collections.emptyList();
    }

    @PostMapping("/clear")
    public String clearCart(HttpSession session) {
        // Удаляем один атрибут
        session.removeAttribute("userCart");
        // Или полностью инвалидируем (уничтожаем) сессию
        // session.invalidate();
        return "Cart cleared";
    }
}
```

### **4.3.2. Конфигурация сессий в Spring Boot**
В `application.properties`/`application.yml`:
```yaml
server:
  servlet:
    session:
      timeout: 30m           # Таймаут сессии (по умолчанию 30 минут)
      cookie:
        name: SESSION_ID     # Имя куки сессии (по умолчанию JSESSIONID)
        http-only: true      # Запрет доступа JS к куке сессии
        secure: true         # Только HTTPS (рекомендуется)
        same-site: strict    # Политика SameSite
```


## 4.4. Теоретический фундамент: протокол HTTP и состояние

**HTTP — stateless протокол.** Каждый запрос независим. Для сохранения состояния между запросами (корзина, логин, настройки) используются два основных механизма:
1.  **Куки (Cookies)** — небольшой фрагмент данных, который сервер отправляет браузеру. Браузер хранит его и автоматически прикладывает к каждому последующему запросу на тот же домен.
2.  **Сессии (Sessions)** — более высокоуровневая абстракция. **Сессия хранится на сервере** (в памяти, БД, Redis). Клиенту же передаётся только **идентификатор сессии (JSESSIONID)**, обычно внутри куки.
### 4.4.1. Сравнение подходов: куки vs сессии

| Критерий | Куки (Cookie) | Сессия (HttpSession) |
| :--- | :--- | :--- |
| **Место хранения** | Браузер пользователя (клиентская сторона) | Сервер приложения (серверная сторона) |
| **Объём данных** | Ограничены (~4 KB на домен) | Значительно больше (ограничено памятью сервера) |
| **Безопасность** | Уязвимы к XSS/CSRF. Требуют правильных флагов (`httpOnly`, `secure`, `sameSite`) | Данные защищены на сервере. Уязвима только кука с ID сессии (сессионная фиксация) |
| **Масштабируемость** | Отлично. Данные хранятся у клиента, сервер stateless | Проблематично. Требует репликации сессий между нодами или внешнего хранилища |
| **Типичное применение** | Идентификатор для JWT-токена, настройки UI (тема, язык), трекинг-аналитика | Корзина покупок, сложное состояние многошаговой формы, данные пользователя в legacy-системах |
#### **Паттерн: токен в куке (Stateless-сессия)**
Современная альтернатива `HttpSession` — хранить зашифрованный токен (например, JWT) в защищённой куке.
*   **Сервер** при логине создаёт JWT, кладёт его в куку `httpOnly`.
*   **При каждом запросе** браузер автоматически отправляет эту куку.
*   **Сервер** проверяет подпись токена, извлекает данные из payload (например, `userId`). **Не хранит состояние на сервере.** Это золотой стандарт для REST API и SPA.

```java
// Пример создания JWT-куки после успешной аутентификации
ResponseCookie jwtCookie = ResponseCookie.from("jwt", jwtToken)
        .httpOnly(true)
        .secure(true)
        .path("/api")
        .maxAge(Duration.ofDays(1))
        .sameSite("Lax") // Для кросс-доменных API-запросов может быть "None"
        .build();
```
### FAQ

**В1: как выбрать между сессией и токеном в куке для нового проекта?**
*   **Выбирай `HttpSession`**, если строишь **классическое монолитное приложение Spring MVC** с рендерингом HTML на сервере (Thymeleaf, JSP). Это просто и работает «из коробки».
*   **Выбирай JWT в куке `httpOnly`**, если у тебя **SPA (React, Angular, Vue) + REST API backend**, особенно если фронтенд и бэкенд на разных доменах/поддоменах или планируется масштабирование до микросервисов.

**В2: почему не используют `HttpSession` в REST API?**
Потому что REST по определению должен быть **stateless**. Каждый запрос должен содержать всю необходимую для его обработки информацию (обычно в заголовке Authorization). Сервер не должен хранить состояние сессии между запросами — это нарушает принципы REST и убивает масштабируемость.

**В3: где физически хранится стандартная сессия Tomcat / Spring Boot?**
По умолчанию — **в оперативной памяти (heap) приложения**. Вот почему при перезапуске приложения все сессии теряются и почему хранение больших объектов в сессии приводит к `OutOfMemoryError`.

**В4: можно ли использовать куки и сессии одновременно?**
Да, так обычно и происходит. **Кука (JSESSIONID)** технически используется как ключ для доступа к **данным сессии на сервере**. Ты также можешь иметь дополнительные куки для аналитики, предпочтений (тема) и так далее.

### Итоговый архитектурный совет

Для современных облачных приложений стремись к **stateless-архитектуре**:
-  **данные аутентификации**: JWT в куке `httpOnly`, `Secure`, `SameSite=Lax/Strict`;
-  **временные данные (корзина)**: храни в БД, привязав к `userId` из токена, или в клиентском хранилище (localStorage, если данные не секретны);
-  **настройки пользователя**: в профиле в БД, а не в куках/сессии.

--- 

# **Часть 5: валидация данных на уровне контроллеров**

Валидация входных данных — это **не функция, а обязанность**. Это первый и самый важный рубеж защиты приложения. Давай разберём её так, как это делается в enterprise-разработке.

## 5.1. Философия валидации: Defense in Depth

**Валидировать нужно ВСЁ, что приходит извне.** Принцип «защиты в глубину» предполагает несколько уровней:
1.  **Клиентская валидация** (HTML5, JavaScript) — для UX.
2.  **Валидация на уровне контроллера (DTO)** — основной рубеж. **То, что мы разберём сегодня.**
3.  **Валидация на уровне бизнес-логики (сервисы)** — проверка инвариантов предметной области.
4.  **Валидация на уровне persistence (БД)** — ограничения (constraints), триггеры.

**Золотое правило: никогда не доверяй данным от клиента.** Даже если твой фронтенд валидирует данные, злоумышленник может отправить запрос напрямую через curl или Postman.

## 5.2. Базовый стек технологий (Bean Validation)
Spring использует стандарт **Jakarta Bean Validation** (ранее Java Bean Validation). Основные зависимости в Spring Boot:

```xml
<!-- Spring Boot Starter Validation (включает Hibernate Validator) -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-validation</artifactId>
</dependency>
```

### Уровень 1: валидация DTO в контроллере

**Это основной и обязательный уровень.** Валидируем данные сразу при входе в приложение.
#### **1.1. Аннотации для полей DTO**

```java
public class UserCreateDto {

    @NotBlank(message = "Имя пользователя обязательно")
    @Size(min = 3, max = 50, message = "Имя пользователя должно быть от {min} до {max} символов")
    private String username;

    @Email(message = "Некорректный адрес электронной почты")
    @NotBlank
    private String email;

    @Pattern(regexp = "^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z]).{8,}$", 
             message = "Пароль должен содержать минимум 8 символов, цифру, букву в верхнем и нижнем регистре")
    private String password;

    @Min(value = 18, message = "Возраст должен быть не менее {value}")
    @Max(100)
    private Integer age;

    @Past(message = "Дата рождения должна быть в прошлом")
    private LocalDate birthDate;

    @NotNull(message = "Роль пользователя должна быть указана")
    private UserRole role;

    @AssertTrue(message = "Необходимо согласие с условиями")
    private Boolean termsAccepted;

    @DecimalMin(value = "0.0", inclusive = false, message = "Цена должна быть положительной")
    @Digits(integer = 5, fraction = 2, message = "Некорректный формат цены")
    private BigDecimal price;

    @NotEmpty(message = "Должен быть указан хотя бы один телефон")
    private List<@Pattern(regexp = "^\\+7\\d{10}$") String> phones; // Валидация элементов коллекции!
}
```

#### **1.2. Активация валидации в контроллере**

Используй аннотацию `@Valid` (или `@Validated` для групп) перед телом запроса:

```java
@RestController
@RequestMapping("/api/users")
public class UserController {

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse createUser(@RequestBody @Valid UserCreateDto createDto) {
        // Если валидация не пройдена, выполнение НИКОГДА не дойдёт до этой строки
        return userService.create(createDto);
    }

    @PutMapping("/{id}")
    public UserResponse updateUser(@PathVariable Long id, 
                                   @RequestBody @Valid UserUpdateDto updateDto) {
        return userService.update(id, updateDto);
    }
}
```

**Что происходит под капотом**
1.  Spring перехватывает запрос и выполняет привязку данных к DTO.
2.  **До вызова метода контроллера** запускается Hibernate Validator.
3.  Если есть нарушения — выбрасывается `MethodArgumentNotValidException`.
4.  Spring перехватывает это исключение и возвращает HTTP 400 (Bad Request) с описанием ошибок.

### Уровень 2: группы валидации

**Проблема**: одни и те же поля могут требовать разных правил для создания и обновления сущности.

**Решение**: группы валидации (Validation Groups).

```java
// 1. Определяем маркерные интерфейсы (можно использовать классы)
public interface OnCreate {}
public interface OnUpdate {}

// 2. Применяем группы в DTO
public class UserDto {

    @NotNull(groups = OnUpdate.class, message = "ID обязателен при обновлении")
    @Null(groups = OnCreate.class, message = "ID не должен указываться при создании")
    private Long id;

    @NotBlank(groups = {OnCreate.class, OnUpdate.class})
    @Size(min = 3, max = 50)
    private String username;
}
```

```java
// 3. Указываем группу в контроллере
@PostMapping
public UserResponse create(@RequestBody @Validated(OnCreate.class) UserDto dto) {
    // Валидация только для группы OnCreate
}

@PutMapping("/{id}")
public UserResponse update(@PathVariable Long id, 
                          @RequestBody @Validated(OnUpdate.class) UserDto dto) {
    // Валидация только для группы OnUpdate
}
```
### Уровень 3: валидация в сервисном слое

**Важно**: валидация в контроллере проверяет **формат и наличие данных**. Валидация в сервисе проверяет **бизнес-правила**.

```java
@Service
@Validated // Включаем валидацию на уровне методов!
public class UserService {

    public UserResponse create(@Valid UserCreateDto dto) {
        // Валидация DTO уже пройдена в контроллере
        // Здесь проверяем бизнес-правила:
        
        if (userRepository.existsByEmail(dto.getEmail())) {
            throw new BusinessValidationException("Email уже используется");
        }
        
        if (dto.getBirthDate() != null && 
            Period.between(dto.getBirthDate(), LocalDate.now()).getYears() < 18) {
            throw new BusinessValidationException("Пользователь должен быть старше 18 лет");
        }
        
        // …логика создания
    }

    // Валидация параметров метода
    public User findById(@Min(1) Long id) {
        // Spring проверит, что id ≥ 1 до вызова метода
        return userRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("User not found"));
    }
}
```

**Для работы валидации на уровне сервиса** нужна аннотация `@Validated` на классе сервиса.

### Критические ошибки и подводные камни

-  **Валидация Entity вместо DTO**
    ```java
    // КАТЕГОРИЧЕСКИ НЕВЕРНО!
    @Entity
    public class User {
        @NotBlank // Не смешивай JPA и валидацию!
        private String username;
    }
    
    @PostMapping
    public void create(@RequestBody @Valid User user) { // Опасно!
    ```
**Проблема**: нарушение слоистой архитектуры.  
**Решение**: всегда используй отдельные DTO для запросов.

-  **Отсутствие обработки `@Valid` на вложенных объектах**
    ```java
    public class OrderCreateDto {
        @Valid // Без этой аннотации валидация AddressDto не сработает!
        private AddressDto deliveryAddress;
    }
    ```

-  **Небезопасные сообщения об ошибках**
    ```java
    @NotBlank(message = "Password for user " + userService.getCurrentUser() + " is empty")
    // Не делай так! Это вызов метода в рантайме
    ```

-  **Игнорирование валидации `@RequestParam` и `@PathVariable`**
    ```java
    @GetMapping("/users/{id}")
    public User getUser(@PathVariable @Min(1) Long id) { // Работает с @Validated на контроллере
        // ...
    }
    
    @GetMapping("/search")
    public List<User> search(@RequestParam @Size(min=2) String query) {
        // ...
    }
    ```

### Тестирование валидации

**Юнит-тест валидатора**
```java
class StrongPasswordValidatorTest {

    private Validator validator;

    @BeforeEach
    void setUp() {
        ValidatorFactory factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @Test
    void whenPasswordTooShort_thenValidationFails() {
        UserCreateDto dto = new UserCreateDto();
        dto.setPassword("Short1!"); // 7 символов
        
        Set<ConstraintViolation<UserCreateDto>> violations = 
            validator.validate(dto);
        
        assertThat(violations).hasSize(1);
        assertThat(violations.iterator().next().getMessage())
            .contains("минимум 8 символов");
    }
}
```

**Интеграционный тест контроллера**
```java
@SpringBootTest
@AutoConfigureMockMvc
class UserControllerValidationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void whenCreateUserWithInvalidEmail_thenBadRequest() throws Exception {
        String invalidUserJson = "{\"email\": \"not-an-email\", \"password\": \"ValidPass123!\"}";
        
        mockMvc.perform(post("/api/users")
                .contentType(MediaType.APPLICATION_JSON)
                .content(invalidUserJson))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("email"))
                .andExpect(jsonPath("$.errors[0].message").exists());
    }
}
```

### Итоговый чек-лист для production

1. **Все входные DTO** имеют аннотации валидации.
2.   **Все методы контроллеров**, принимающие `@RequestBody`, помечены `@Valid`.
3.  **Реализован `@RestControllerAdvice`** с обработкой `MethodArgumentNotValidException`.
4.  **Сообщения об ошибках** не раскрывают внутреннюю структуру приложения.
5.   **Кастомные валидаторы** созданы для сложных бизнес-правил.
6.  **Используются группы валидации** для разных сценариев (create/update).
7.  **Валидация `@RequestParam` и `@PathVariable`** настроена через `@Validated` на контроллере.
8. **Сервисный слой** проверяет бизнес-инварианты.
9.  **Написаны тесты** для всех валидаторов и сценариев валидации.
10. **Документация API** (Swagger/OpenAPI) включает описания constraints.

**Помни**: хорошая валидация — это не только защита, но и качественный UX. Чёткие, понятные сообщения об ошибках экономят время и пользователям, и разработчикам, которые с твоим API интегрируются.

---

### **Часто задаваемые вопросы**

**В1: когда использовать `@Controller`, а когда — `@RestController`?**
*   **`@Controller`** — для классических веб-приложений, которые рендерят HTML (MVC).
*   **`@RestController`** — для RESTful API, которые возвращают JSON/XML.

**В2: почему у меня `@RequestBody` всегда `null`?**
1.  Проверь заголовок `Content-Type` запроса. Для JSON должно быть `application/json`.
2.  Убедись, что поля JSON совпадают по именам с полями DTO (чувствительно к регистру).
3.  Проверь, есть ли в DTO геттеры и сеттеры для полей (или поля `public`, но это плохая практика).

**В3: в чём разница между `@PathVariable` и `@RequestParam`?**
*   `@PathVariable` — часть пути URL: `/users/{id}`.
*   `@RequestParam` — параметр строки запроса: `/users?page=1&size=20`.

**В4: обязательно ли использовать DTO? Это же лишний код.**
Да, обязательно для нетривиальных приложений. Это не «лишний код», а инвестиция в поддерживаемость, безопасность и чёткое разделение ответственности. Начинай с DTO с самого начала.

---

# **Часть 6: лучшие практики и итоги**

-  **Слой контроллера должен быть тонким.** Его задача — получить запрос, делегировать логику сервису, обработать ответ. Вся бизнес-логика — в сервисном слое.
-  **Всегда валидируй входные данные.** Используй `@Valid` на `@RequestBody` и DTO с constraints (`@NotBlank`, `@Email`).
-  **Используй правильные HTTP-статусы.** `200 OK`, `201 Created`, `204 No Content`, `400 Bad Request`, `404 Not Found`, `500 Internal Server Error`.
-  **Документируй свой API.** Используй Swagger/OpenAPI (`springdoc-openapi`). Это спасёт тебя и твоих фронтенд-разработчиков.
-  **Пиши тесты.** `@WebMvcTest` для изолированного тестирования контроллеров — твой лучший друг.
-  **Помни о безопасности**: экранируй вывод, защищайся от XSS, CSRF, не доверяй данным от клиента.
