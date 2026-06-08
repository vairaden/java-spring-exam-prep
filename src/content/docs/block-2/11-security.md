---
title: "11. Spring Security и JWT"
description: "Filter chain, AuthenticationManager, PasswordEncoder, аутентификация/авторизация, JWT"
---

> Spring Security. Архитектура и конфигурирование. AuthenticationManager. PasswordEncoder. Аутентификация и авторизация. JWT.

## Архитектура: цепочка фильтров

Spring Security — это **цепочка сервлет-фильтров**, а не «магия». Запрос проходит через:
- **`DelegatingFilterProxy`** — мост из сервлет-контейнера в Spring.
- **`FilterChainProxy`** — управляет `SecurityFilterChain`.
- **`SecurityFilterChain`** — упорядоченный набор фильтров
  (`UsernamePasswordAuthenticationFilter`, `BearerTokenAuthenticationFilter`,
  `ExceptionTranslationFilter`, `FilterSecurityInterceptor`/`AuthorizationFilter` и др.).

Результат успешной аутентификации кладётся в **`SecurityContextHolder`** (потоко-локальный
`SecurityContext` с `Authentication`).

## Аутентификация vs авторизация

- **Аутентификация (authentication)** — *кто ты*: проверка учётных данных.
- **Авторизация (authorization)** — *что тебе можно*: проверка прав/ролей на ресурс.

## AuthenticationManager и провайдеры

- **`AuthenticationManager`** (обычно `ProviderManager`) — точка входа аутентификации;
  делегирует списку **`AuthenticationProvider`**.
- **`AuthenticationProvider`** (например, `DaoAuthenticationProvider`) — проверяет
  `Authentication`: грузит пользователя через **`UserDetailsService`** и сверяет пароль
  через **`PasswordEncoder`**.
- **`UserDetailsService.loadUserByUsername()`** — возвращает `UserDetails` (логин, хеш
  пароля, роли).

## PasswordEncoder

Пароли **никогда** не хранятся в открытом виде — только хеш с солью. `PasswordEncoder`
кодирует и сверяет:
```java
@Bean PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder();   // адаптивный, с солью
}
encoder.matches(rawPassword, storedHash);
```
Рекомендуется `BCrypt`/`Argon2`/`PBKDF2`; `DelegatingPasswordEncoder` поддерживает несколько
схем (префикс `{bcrypt}`).

## Конфигурирование (Spring Security 6)

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {
    @Bean
    SecurityFilterChain chain(HttpSecurity http) throws Exception {
        http
          .csrf(csrf -> csrf.disable())                 // для stateless API
          .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
          .authorizeHttpRequests(auth -> auth
              .requestMatchers("/api/auth/**").permitAll()
              .requestMatchers("/api/admin/**").hasRole("ADMIN")
              .anyRequest().authenticated())
          .oauth2ResourceServer(o -> o.jwt(Customizer.withDefaults()));
        return http.build();
    }
}
```
Метод-уровневая авторизация: `@EnableMethodSecurity` + `@PreAuthorize("hasRole('ADMIN')")`.

## JWT (JSON Web Token)

Stateless-аутентификация: после логина сервер выдаёт **подписанный токен**, клиент шлёт его
в `Authorization: Bearer <token>`. Сервер проверяет **подпись** и не хранит сессию.

Структура: **`header.payload.signature`** (Base64URL). Payload содержит claims (`sub`,
`exp`, `roles`). Подпись (HMAC/RSA) гарантирует целостность.

```
1. POST /login (логин+пароль) → сервер проверяет → выдаёт JWT
2. Клиент: Authorization: Bearer eyJ...
3. Фильтр валидирует подпись и exp → заполняет SecurityContext
```
Плюсы: масштабируемость (нет серверной сессии), удобно для микросервисов. Минусы: токен
**нельзя легко отозвать** до истечения (нужны короткий TTL + refresh-токены, чёрный список).
Хранить секрет подписи безопасно; не класть в payload чувствительные данные (он лишь
закодирован, не зашифрован).

## 🔗 Смежные вопросы
- [Б1.14 — Файлы и состояние (сессии vs stateless)](/block-1/14-file-upload-state/)
- [Б2.12 — RestClient (отправка Bearer-токена)](/block-2/12-restclient/)
- [Б1.5 — Spring AOP и прокси (@PreAuthorize)](/block-1/05-aop-proxies/)

## 📚 Материалы
- [Лонгрид 9 — Spring Security](/longreads/09-spring-security/)
