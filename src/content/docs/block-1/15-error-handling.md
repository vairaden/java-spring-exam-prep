---
title: "15. Обработка ошибок"
description: "@ControllerAdvice, @ExceptionHandler, единый формат ошибок"
---

> Обработка ошибок. @ControllerAdvice. @ExceptionHandler.

## Зачем централизовать обработку ошибок

Чтобы не дублировать `try/catch` в каждом методе и отдавать клиенту **единый формат
ошибки** с правильным HTTP-статусом. Spring перехватывает исключения через
`HandlerExceptionResolver` и направляет их в обработчики.

## @ExceptionHandler (локально)

Метод внутри контроллера, обрабатывающий заданный тип исключения **в пределах этого
контроллера**:
```java
@ExceptionHandler(TaskNotFoundException.class)
public ResponseEntity<ErrorResponse> handle(TaskNotFoundException ex) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND)
        .body(new ErrorResponse("TASK_NOT_FOUND", ex.getMessage()));
}
```

## @ControllerAdvice / @RestControllerAdvice (глобально)

Класс с обработчиками, применяемыми **ко всем контроллерам**. `@RestControllerAdvice` =
`@ControllerAdvice` + `@ResponseBody`:
```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(TaskNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ErrorResponse notFound(TaskNotFoundException ex) {
        return new ErrorResponse("TASK_NOT_FOUND", ex.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorResponse validation(MethodArgumentNotValidException ex) {
        Map<String, String> errors = ex.getBindingResult().getFieldErrors().stream()
            .collect(Collectors.toMap(FieldError::getField, FieldError::getDefaultMessage));
        return new ErrorResponse("VALIDATION_ERROR", errors.toString());
    }

    @ExceptionHandler(Exception.class)              // fallback
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ErrorResponse generic(Exception ex) {
        log.error("Unhandled", ex);
        return new ErrorResponse("INTERNAL_ERROR", "Internal server error");
    }
}
```

## Сопоставление исключений и статусов

- Бросать **доменные исключения** (`TaskNotFoundException`) вместо технических
  (`NoSuchElementException`) — понятнее и легче маппить на статус.
- `@ResponseStatus` на классе исключения задаёт статус без отдельного обработчика.
- Приоритет обработчиков: более конкретный тип исключения побеждает; общий
  `Exception.class` — fallback.

## ResponseEntityExceptionHandler и ProblemDetail

Можно наследовать `ResponseEntityExceptionHandler`, чтобы переопределить обработку
стандартных Spring-исключений. Современный стандарт формата ошибки — **RFC 7807
`ProblemDetail`** (`application/problem+json`), поддерживается из коробки:
```java
@ExceptionHandler(TaskNotFoundException.class)
public ProblemDetail handle(TaskNotFoundException ex) {
    ProblemDetail pd = ProblemDetail.forStatus(HttpStatus.NOT_FOUND);
    pd.setDetail(ex.getMessage());
    return pd;
}
```

## Важные нюансы

- Возвращать `404`/`400` на неизвестные пути: `spring.mvc.throw-exception-if-no-handler-found: true`
  + `spring.web.resources.add-mappings: false`, и обработать `NoHandlerFoundException`.
- Не отдавать клиенту стектрейсы и внутренние детали — логировать на сервере, наружу —
  обобщённое сообщение и код.

## 🔗 Смежные вопросы
- [Б1.13 — Контроллеры, DTO, валидация](/block-1/13-controllers-dto/)
- [Б1.12 — Ответы, ResponseEntity, CORS](/block-1/12-responses-cors/)
- [Б1.17 — Логирование и MDC](/block-1/17-logging/)

## 📚 Материалы
- [Лонгрид 4 — Spring MVC и RESTful-сервисы](/longreads/04-spring-mvc-rest/)
