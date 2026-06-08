---
title: "14. Загрузка файлов и работа с состоянием"
description: "MultipartFile, raw-загрузка, заголовки, куки, сессии"
---

> Загрузка файлов: raw и MultipartFile. Работа с состоянием: заголовки, куки, сессии.

## Загрузка файлов: MultipartFile

Стандартный способ — `multipart/form-data` и `MultipartFile`:
```java
@PostMapping(value = "/{taskId}/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
public ResponseEntity<AttachmentDto> upload(
        @PathVariable Long taskId,
        @RequestParam("file") MultipartFile file) throws IOException {
    String name = file.getOriginalFilename();
    long size = file.getSize();
    file.transferTo(Path.of(uploadDir, name));   // сохранение
    // или file.getBytes() / file.getInputStream()
    return ResponseEntity.ok(service.save(taskId, name, size));
}
```
Несколько файлов — `MultipartFile[]` или `List<MultipartFile>`. Лимиты в конфиге:
```yaml
spring.servlet.multipart.max-file-size: 10MB
spring.servlet.multipart.max-request-size: 20MB
```

## Загрузка raw (тело запроса целиком)

Когда клиент шлёт «сырые» байты (`application/octet-stream`), читаем тело напрямую:
```java
@PostMapping(value = "/upload-raw", consumes = MediaType.APPLICATION_OCTET_STREAM_VALUE)
public ResponseEntity<Void> uploadRaw(@RequestBody byte[] data) { ... }
// или InputStreamResource / HttpServletRequest.getInputStream() для стриминга больших файлов
```

## Скачивание файла

```java
@GetMapping("/{id}/download")
public ResponseEntity<Resource> download(@PathVariable Long id) {
    Resource res = service.loadAsResource(id);
    return ResponseEntity.ok()
        .contentType(MediaType.APPLICATION_OCTET_STREAM)
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + res.getFilename() + "\"")
        .body(res);
}
```

## Работа с состоянием

HTTP **stateless** — каждый запрос независим. Состояние поддерживают:

**Заголовки** — метаданные запроса/ответа. Чтение:
```java
@GetMapping public String h(@RequestHeader("User-Agent") String ua) { ... }
```

**Куки** — небольшие данные, хранящиеся в браузере и отправляемые с каждым запросом:
```java
@GetMapping
public ResponseEntity<String> pref(@CookieValue(value = "view", defaultValue = "compact") String view) {
    Cookie cookie = new Cookie("view", "expanded");
    cookie.setHttpOnly(true);       // недоступна JS (защита от XSS)
    cookie.setMaxAge(7 * 24 * 3600);
    cookie.setPath("/");
    // response.addCookie(cookie)
}
```

**Сессии** — серверное состояние, привязанное к клиенту через cookie `JSESSIONID`:
```java
@PostMapping("/favorites/{id}")
public void addFavorite(@PathVariable Long id, HttpSession session) {
    Set<Long> favs = (Set<Long>) session.getAttribute("favoriteTaskIds");
    if (favs == null) { favs = new HashSet<>(); session.setAttribute("favoriteTaskIds", favs); }
    favs.add(id);
}
```
Сессии хранят состояние на сервере (в памяти/Redis), куки — на клиенте. Для масштабирования
сессии выносят во внешнее хранилище (Spring Session + Redis) либо переходят на stateless
(JWT).

## 🔗 Смежные вопросы
- [Б1.13 — Контроллеры, DTO, валидация](/block-1/13-controllers-dto/)
- [Б1.12 — Ответы, ResponseEntity, CORS](/block-1/12-responses-cors/)
- [Б2.11 — Spring Security, JWT (сессии vs stateless)](/block-2/11-security/)

## 📚 Материалы
- [Лонгрид 4 — Spring MVC и RESTful-сервисы](/longreads/04-spring-mvc-rest/)
- [Лонгрид 5 — DispatcherServlet и формирование ответов](/longreads/05-dispatcher-responses/)
