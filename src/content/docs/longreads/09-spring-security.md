---
title: "Лонгрид 9. Spring Security"
description: "Filter chain, аутентификация, авторизация, JWT"
---

Spring Security — это не «магия», это Servlet Filter Chain. Весь процесс защиты строится вокруг DelegatingFilterProxy, который передаёт управление в FilterChainProxy.  
Ключевой компонент: SecurityFilterChain.

**Как это работает на самом деле** 

Раньше мы наследовались от WebSecurityConfigurerAdapter. Это в прошлом (deprecated с версии 5.7). Сейчас мы используем SecurityFilterChain как Bean.

**Пример конфигурации (Bean-based)**

```java
@Configuration  
@EnableWebSecurity  
public class SecurityConfig {  
  
	@Bean  
	public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {  
		http  
			.csrf(csrf -> csrf.disable()) // Отключаем для Stateless (JWT)  
			.authorizeHttpRequests(auth -> auth  
			.requestMatchers("/api/v1/auth/**").permitAll()  
			.anyRequest().authenticated()  
			)  
			.sessionManagement(session -> session  
			.sessionCreationPolicy(SessionCreationPolicy.STATELESS)  
		);  
		return http.build();  
	}  
}  
```

Многие отключают CSRF «по привычке». Если ты строишь монолит с сессиями, это дыра в безопасности.

В Spring Security есть только фильтры. Когда запрос летит в твой контроллер, он проходит через строй из 15–20 фильтров. Если хоть один скажет «нет» — запрос мёртв.

**Ключевые этапы конфигурации**

* Отключение CSRF. В 99% туториалов пишут .csrf().disable(). Ты понимаешь зачем? Если у тебя Stateless API (JWT), тебе не нужны куки, а значит, атака Cross-Site Request Forgery невозможна. Но если ты оставишь сессии и отключишь CSRF, ты создашь дыру в безопасности.  
* Session Policy. Для JWT мы обязаны выставить STATELESS. Это приказ Spring: «Не создавай сессию на сервере, не трать память, верь только токену».  
* AuthorizeHttpRequests. Здесь ты строишь карту доступа. Правило: от частного к общему. Сначала разрешаем /login, потом закрываем всё остальное anyRequest().authenticated().

Ошибка № 1 — неправильный порядок requestMatchers. Если ты поставишь anyRequest().authenticated() в начало, твои фильтры для логина просто не сработают.

---
# Аутентификация vs авторизация
Разделяй эти понятия жёстко.
* Аутентификация (Authentication): «Кто ты?» Процесс проверки предоставленных учётных данных.
* Авторизация (Authorization): «Что тебе позволено?» Проверка прав доступа после успешной аутентификации.

## Механизм AuthenticationManager

В Spring за это отвечает AuthenticationManager.

* Идёт к UserDetailsService (твой интерфейс для работы с БД).  
* Сверяет пароли через PasswordEncoder.  
* Важно: если пароль в БД лежит в открытом виде или захеширован MD5, проект можно закрывать. Используй только BCryptPasswordEncoder или Argon2.

AuthenticationManager использует список AuthenticationProvider.
1. Фильтр перехватывает запрос. 
2. Он получает твой логин/пароль (или токен).  
3. Создаёт UsernamePasswordAuthenticationToken.
4. AuthenticationManager ищет провайдера, который может обработать этот токен.
5. DaoAuthenticationProvider (самый частый случай) идёт в UserDetailsService за данными из БД.  

Возможная ошибка: разработчики часто хранят пароли в BCrypt, но забывают про «соль» и «перец» — про это поговорим дальше.

## 1. Сущность пользователя и репозиторий (пример)
```java
// entity
@Entity
@Table(name = "users")
public class UserEntity {
    @Id @GeneratedValue
    private Long id;

    @Column(unique = true, nullable = false)
    private String username;

    // тут хранится ХЕШ, а не пароль
    @Column(nullable = false)
    private String passwordHash;

    private boolean enabled = true;

    // getters/setters
}
```

```java
public interface UserRepository extends JpaRepository<UserEntity, Long> {
    Optional<UserEntity> findByUsername(String username);
}
```
## 2. UserDetailsService: «идёт к БД»
```java
@Service
public class DbUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    public DbUserDetailsService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        UserEntity user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));

        return User.builder()
                .username(user.getUsername())
                .password(user.getPasswordHash())
                .disabled(!user.isEnabled())
                .roles("USER") // пример
                .build();
    }
}
```

Username из `httpSecurity`: `formLogin`, `httpBasic`, свои фильтры, JWT и тому подобное.

## 3. PasswordEncoder: BCrypt или Argon2

```java
@Configuration
public class PasswordConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        // strength (cost) можно указать: new BCryptPasswordEncoder(12)
        return new BCryptPasswordEncoder();
    }
}
```

## 4. Как Spring сверяет пароль через PasswordEncoder
```java

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthenticationManager authenticationManager;

    public AuthController(AuthenticationManager authenticationManager) {
        this.authenticationManager = authenticationManager;
    }

    @PostMapping("/login")
    public String login(@RequestBody LoginRequest req) {
        Authentication auth = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(req.username(), req.password())
        );
        return "OK, authenticated as " + auth.getName();
    }

    public record LoginRequest(String username, String password) {}
}
```

```java

@Configuration
public class AuthManagerConfig {

    @Bean
    AuthenticationManager authenticationManager(AuthenticationConfiguration cfg) throws Exception {
        return cfg.getAuthenticationManager();
    }
}
```

Когда Spring понял, что ты — это ты, в дело вступают GrantedAuthority (роли и права).  
* ROLE_USER — это роль.  
* READ_PRIVILEGE — это право (authority).  
* Spring проверяет их через AccessDecisionManager (в новых версиях — AuthorizationManager).

```java
@Service
public class DbUserDetailsService implements UserDetailsService {

    private final UserRepository repo;

    public DbUserDetailsService(UserRepository repo) {
        this.repo = repo;
    }

    @Override
    public UserDetails loadUserByUsername(String username) {
        UserEntity user = repo.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException(username));

        // Пример: у пользователя есть роль USER и право READ_PRIVILEGE
        List<GrantedAuthority> authorities = List.of(
                new SimpleGrantedAuthority("ROLE_USER"),       // роль
                new SimpleGrantedAuthority("READ_PRIVILEGE")   // право/permission
        );

        return new org.springframework.security.core.userdetails.User(
                user.getUsername(),
                user.getPasswordHash(),
                authorities
        );
    }
}
```


```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
            .csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(auth -> auth
                // Требуется роль USER (то есть authority "ROLE_USER")
                .requestMatchers("/api/profile/**").hasRole("USER")

                // Требуется право READ_PRIVILEGE (обычная authority без ROLE_)
                .requestMatchers(HttpMethod.GET, "/api/docs/**").hasAuthority("READ_PRIVILEGE")

                // Любая аутентификация
                .anyRequest().authenticated()
            )
            .httpBasic(Customizer.withDefaults())
            .build();
    }
}

```

```java
@Configuration
@EnableMethodSecurity
public class MethodSecurityConfig { }
```

```java

@RestController
@RequestMapping("/api")
public class DemoController {

    // Доступ только для роли USER
    @PreAuthorize("hasRole('USER')")
    @GetMapping("/profile")
    public String profile() {
        return "profile";
    }

    // Доступ только при наличии права READ_PRIVILEGE
    @PreAuthorize("hasAuthority('READ_PRIVILEGE')")
    @GetMapping("/docs")
    public String docs() {
        return "docs";
    }

    // Можно комбинировать
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('READ_PRIVILEGE')")
    @GetMapping("/mixed")
    public String mixed() {
        return "mixed";
    }
}
```

> Возможная ошибка: использовать роли (hasRole), но забывать, что роли — это просто строки с префиксом ROLE_. Если в БД роль ADMIN, а в коде hasRole("ADMIN"), Spring будет искать ROLE_ADMIN. Несоответствие — и ты ловишь 403.

---
# JWT (JSON Web Token) и работа с ним
JWT — это открытый стандарт RFC 7519. Это не способ шифрования, это способ подписи данных.

**Структура токена**
* Header: алгоритм (например, HS256).
* Payload: claims (субъект, роли, срок действия).
* Signature: хеш заголовка и полезной нагрузки, созданный с помощью секретного ключа.

**Реализация в Spring Security** 

Для работы с JWT нам нужно вклиниться в цепочку фильтров перед стандартным фильтром аутентификации. 

**Шаги реализации**

* JwtUtils: класс для генерации и валидации (используем библиотеку jjwt или com.auth0).
* JwtRequestFilter: наследуемся от OncePerRequestFilter.
* Достаём токен из заголовка `Authorization: Bearer \<token>`.
* Проверяем подпись и срок действия (exp).
* Устанавливаем `SecurityContextHolder.getContext().setAuthentication(...)`.
  
JWT невозможно отозвать (revoke) до истечения срока его действия без внедрения сторонних технологий. Если твой access token живёт 24 часа и его украли — тебя скомпрометировали на сутки.  Решение: короткое время жизни access-токена (5–15 минут) + использование refresh-токенов.

JWT (JSON Web Token) — это не способ скрыть данные. Это способ передать их так, чтобы их нельзя было подделать.  

**Из чего состоит этот «бутерброд»**

* Header — сообщает, какой алгоритм подписи используется (обычно HS256).  
* Payload — здесь лежат данные (Claims): sub (username), exp (дата протухания), roles.  Внимание: любой может декодировать Payload на сайте [jwt.io](https://jwt.io/ "https://jwt.io/"). Никогда не клади туда пароли или секретные данные!  
* Signature — это захешированные Header + Payload + твой секретный ключ (Secret Key).

**Жизненный цикл JWT в Spring** 

* Клиент присылает токен в заголовке Authorization: Bearer \<TOKEN>.  
* Твой кастомный JwtFilter перехватывает его.  
* Валидация: ты проверяешь подпись своим секретным ключом. Если подпись совпала, данные в Payload реальные.  
* SecurityContext: ты достаёшь из токена username, создаёшь объект UsernamePasswordAuthenticationToken и кладёшь его в SecurityContextHolder.  
Только после этого Spring считает, что пользователь залогинен.

Секретный ключ: если твой jwt.secret — это слово «password» или «secret123», твой проект взломают за 5 минут перебором. Ключ должен быть длинным и сгенерированным криптографически стойким методом.  
* Проблема выхода: с JWT невозможно нажать «Выйти» на стороне сервера. Токен живёт, пока не истечёт время exp. Если ты не используешь refresh tokens и не хранишь отозванные токены в БД, твоя безопасность «дырявая».  
* Исключения: если в цепочке фильтров что-то упадёт, ты получишь пустой ответ или 500. Обязательно настраивай AuthenticationEntryPoint, чтобы возвращать внятные 401 Unauthorized.  

**План действий** 

* Мысль: осознай, что безопасность — это не «прикрутить библиотеку», а продумать каждый фильтр.  
* Действие: реализуй OncePerRequestFilter для JWT. Убедись, что он стоит в цепочке ДО UsernamePasswordAuthenticationFilter. Используй
```java
http.addFilterBefore(...).  
```

Правило: перестань доверять клиенту. Проверяй exp (expiration) при каждом запросе. Сделай access token на 10 минут, не больше.

## Access и refresh tokens

Refresh token в связке с JWT — это отдельный «долгоживущий» токен, который используется **только для получения нового access token (JWT)**, когда старый access token истёк.
### Зачем он нужен
- **Access token (JWT)** обычно делают короткоживущим (например, 5–15 минут), чтобы снизить риск, если его украдут.
- Чтобы пользователю не приходилось логиниться заново каждые 10 минут, выдают **refresh token** с большим сроком жизни (например, дни/недели).
- Когда access token истёк, клиент идёт на endpoint обновления и предъявляет refresh token → сервер выдаёт новый access token (и часто новый refresh token).

### Как это выглядит в Spring (типичный поток)
1. `POST /auth/login` → сервер возвращает:
    - `accessToken` (JWT, короткий TTL);
    - `refreshToken` (длинный TTL, чаще не JWT или JWT, но с особыми правилами).
2. Клиент использует `accessToken` в заголовке:
    - `Authorization: Bearer <accessToken>`.
3. Access token истёк → `POST /auth/refresh` с refresh token.
4. Сервер проверяет refresh token и выдаёт новый access token.

### Важные отличия access vs refresh
- **Access token**: для доступа к API, часто не хранится на сервере (JWT самодостаточный).
- **Refresh token**: для обновления, **должен быть контролируемым сервером** (обычно хранят в БД/кеше, чтобы можно было отозвать).

### Где хранить refresh token
- В веб‑приложениях обычно безопаснее хранить в **HttpOnly Secure cookie** (меньше риск XSS).
- В мобильных/desktop — в защищённом хранилище (Keychain/Keystore).
- Не рекомендуется хранить refresh token в `localStorage` из‑за XSS.

### Что обычно делают на сервере
- Хранят в БД запись: `userId`, `tokenHash`, `expiresAt`, `revoked`, `deviceId` и тому подобные.
- При обновлении часто применяют **rotation**: выдали новый refresh token — старый сразу инвалидировали.
- Можно сделать logout как «отзыв refresh token».

Надёжно проверить, что access token украли, по одному факту запроса обычно **невозможно**: токен выглядит как обычный валидный запрос. Поэтому на практике делают иначе: строят систему так, чтобы (а) украденный access token жил недолго и (б) можно было **остановить дальнейшее продление** (отозвать refresh token) по сигналам риска.

Ниже рабочие подходы.

## 1. Сессии/устройства + привязка refresh token к «сессии»
Храни refresh token как запись сессии в БД:

- `sessionId`,
- `userId`,
- `refreshTokenHash`,
- `expiresAt`,
- `revokedAt`,
- доп. атрибуты: `deviceId`, `userAgent`, «примерный» ip/geo, время последней активности.

Тогда **отозвать refresh token** = пометить сессию как revoked.

Access token при этом несёт `sid`/`sessionId` (claim), чтобы было понятно, к какой сессии он относится.

### Что это даёт
Когда ты понимаешь, что сессия подозрительная, ты отзываешь конкретный refresh token / сессию, и злоумышленник **не сможет обновляться**.

## 2. Rotation refresh token + детект «повторного использования» (самый сильный сигнал)
Схема:
- каждый вызов `/refresh`:
    - старый refresh token становится **invalid**,
    - выдаётся **новый** refresh token.
- храни текущий refresh token (или цепочку) для сессии.

**Если один и тот же refresh token попытались использовать второй раз**, это практически всегда означает кражу refresh token (или race), и это очень сильный индикатор компрометации.
Действие: **отозвать всю сессию** (и часто все сессии пользователя), потребовать re-login.

Это не кража access token, но на практике именно кража refresh token делает атаку долгой. Rotation её режет.

## 3. Проверка access token через интроспекцию/блоклист (если нужно уметь отзывать access token)
Если ты хочешь отозвать именно access token до истечения, есть два варианта.

### Вариант 1: блоклист по `jti`
- В access token добавляешь `jti` (ID токена).
- При подозрении кладёшь `jti` в Redis/DB до времени `exp`.
- На каждом запросе проверяешь, не в блоклисте ли `jti`.

Минус: это делает JWT почти stateful (каждый запрос = обращение к хранилищу).

### Вариант 2: короткий access token + обязательная проверка сессии по `sid`
- Access token содержит `sid`.
- На каждый запрос проверяешь, не revoked ли `sid` (Redis/DB).

Это удобнее, чем блоклист на каждый `jti`, потому что проверяется одна сессия, а не каждый токен.

## 4. Риск‑сигналы (эвристики), по которым можно отзывать refresh token
Ты не докажешь кражу access token, но сможешь **обоснованно заподозрить** и тогда отозвать refresh token.

- Резкая смена страны/ASN/гео за короткое время («impossible travel»).
- Одновременная активность с двух сильно разных IP/гео.
- Смена User-Agent / Device fingerprint (осторожно: UA часто меняется).
- Слишком много попыток 401/refresh.
- Необычные паттерны доступа (частота, эндпоинты).
- Событие «пользователь сменил пароль / включил 2FA» → revoke всех refresh-токенов.

Действие: revoke сессии / refresh-токена, запросить повторный логин.


Если украли **только access token**, ты обычно:
- **не можешь это точно определить**,
- минимизируешь ущерб за счёт **короткого TTL** (5–15 минут)
- и делаешь так, чтобы без refresh token атака не продолжалась долго.

Отзыв refresh token имеет смысл, когда у тебя есть:
- явный сигнал (пользователь нажал «выйти со всех устройств», сообщил о компрометации),
- детект по эвристикам
- или компрометация refresh token (detected reuse при rotation).
### Как это обычно делают в Spring
Частый паттерн:
- access JWT содержит `sub`, `sid`, `exp`, `jti`;
- refresh token — случайная строка, хранится **хешем** в БД;
- `/auth/refresh` проверяет хеш, revoked, expires, rotation;
- optional: фильтр на API проверяет `sid` в Redis (быстро) на revoked.

----

# Работа с паролями

Думать, что захешировать пароль — это достаточно, — значит застрять в 2005 году.
## Почему просто хеш (SHA-256, MD5) — это бесполезно?
Если ты просто берёшь sha256(password), ты не защищаешься. Хакеру не нужно подбирать пароль — ему нужно найти соответствие.
* Rainbow Tables (радужные таблицы) — это гигантские базы предрассчитанных хешей. Для SHA-256 они занимают терабайты, но позволяют узнать пароль за миллисекунды.
* Dictionary Attacks — обычный перебор. Современная видеокарта (RTX 5090 и выше) выдаёт миллиарды хешей в секунду. Ваш «сложный» пароль P@ssword123 будет вскрыт за доли секунды.

## Что такое соль (Salt) на самом деле?
Соль — это криптографически случайная последовательность байтов, которая добавляется к паролю перед хешированием.  


**Зачем она нужна?**
* Уникальность. Даже если у двух пользователей одинаковый пароль (123456), их хеши в базе будут абсолютно разными, потому что соль у каждого своя.
* Защита от Rainbow Tables. Таблицы предрассчитываются под конкретный алгоритм. Если ты добавляешь уникальную соль к каждому паролю, хакеру придётся строить новую радужную таблицу для каждого пользователя в базе. Это делает атаку экономически невыгодной.

**Где хранить соль?**

Запомни: соль — это не секрет. Она хранится в той же таблице базы данных, рядом с хешем. Её задача — не скрыть данные, а сделать невозможной массовую атаку.
## Key Stretching (растягивание ключа) и Cost Factor
Соли мало. Если алгоритм (например, SHA-256) работает слишком быстро, хакер всё равно может использовать Brute Force. Нам нужно сделать так, чтобы проверка одного пароля занимала у сервера, скажем, 100–200 мс. Для пользователя это незаметно, для хакера это катастрофа.  
Итерации: мы прогоняем хеш через самого себя тысячи раз.

В Spring Security за это отвечает Work Factor (или Strength). В BCryptPasswordEncoder значение по умолчанию — 10 (это 2¹⁰ итераций). В 2026 году рекомендуется ставить 12 или выше, в зависимости от мощности железа.

## Современный стандарт: Argon2
Если ты всё ещё используешь BCrypt, это приемлемо, но уже не топ. Argon2 (победитель конкурса Password Hashing Competition) — это стандарт де-факто для высоконагруженных и защищённых систем.  

**Почему он лучше?**
* Time Cost — количество итераций.
* Memory Cost — количество оперативной памяти, которую обязан выделить алгоритм.
* Parallelism — количество потоков.

Это защищает от взлома на FPGA и специализированных чипах (ASIC), которые умеют быстро считать хеши, но имеют мало памяти. Argon2 заставляет чип выделять, например, 64 МБ памяти на каждый перебор. Это делает атаку в миллионы раз дороже.

## Слепая зона: Pepper (перец)
Соль хранится в БД. Если хакер украл дамп базы, у него есть и хеши, и соли.  
Pepper — это секретная строка, которая добавляется к паролю, но не хранится в базе. Она хранится в коде, в переменных окружения или в Vault.  
Если украли только базу, без «перца» взлом хешей становится почти невозможным. Но если ты «зашьёшь» перец прямо в код и запушишь в GitHub, ты своими руками отдашь ключи от сейфа.

**Что нужно делать**
* Обновлять хеши. Когда ты меняешь алгоритм (с BCrypt на Argon2), старые хеши в базе остаются уязвимыми. Обязательно используй паттерн Rehash on Login: когда пользователь успешно залогинился, проверяй, соответствует ли его хеш текущему стандарту. Если нет — перехешируй и сохраняй.
* Не доверять Random. Никогда не используй java.util.Random для генерации соли. Только java.security.SecureRandom. Обычный Random предсказуем, а значит, твоя соль — фикция.
* Не экономить на железе. Ты ставишь cost=8, чтобы сервер не тормозил, и тем самым даришь хакеру фору. Безопасность — это всегда цена ресурсов.

**План действий**
* Действие: проверь текущий PasswordEncoder. Если это NoOp или MD5 — исправь. Перейди на BCryptPasswordEncoder(12) или Argon2PasswordEncoder.
* Мысль: реализуй DelegatingPasswordEncoder. Это позволит системе поддерживать старые хеши и плавно мигрировать на новые без сброса паролей всем пользователям.
* Мысль: относись к базе данных как к публичному документу. Считай, что хакер уже её скачал. Хватит ли сложности хешей, чтобы он потратил 100 лет на их расшифровку?

----

# Logging

## 1. Зачем логирование нужно в реальном проекте

Логи — это не «распечатка программы». Это:
- **диагностика инцидентов**: «Почему 500?», «Почему тормозит?», «Кто вызвал этот endpoint?»
- **наблюдаемость**: метрики и трассировка важны, но лог — единственный артефакт, где можно увидеть контекст конкретного события;
- **аудит и безопасность**: входы/выходы, административные действия, ошибки авторизации;
- **юридическая/операционная отчётность**: иногда нужен след действий.

Отсюда правило: логирование — это часть дизайна системы, а не «добавим println, когда сломается».
## 2. Экосистема логирования в Java: SLF4J, Logback, Log4j2

В современном Spring Boot стандартный стек:
- **SLF4J** — фасад (API): `org.slf4j.Logger`;
- **Logback** — реализация по умолчанию в Spring Boot;
- **Log4j2** — альтернативная реализация (реже в Boot по умолчанию, но встречается).

**Почему нужен фасад?**

Потому что библиотеки могут быть написаны под SLF4J, а ты можешь поменять реализацию (Logback/Log4j2) без переписывания кода.

### Правильный импорт
Всегда:
```java
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
```

Никаких прямых `System.out.println()` в серверном приложении (за редкими исключениями на раннем старте).
## 3. Уровни логирования и их смысл

Уровни — это фильтр важности, а не «чем выше, тем лучше».
- **TRACE** — очень подробная диагностика (в проде почти никогда).
- **DEBUG** — полезно разработчику: ветвления, входные параметры, результаты.
- **INFO** — бизнес-события и ключевые этапы: «пользователь зарегистрирован», «заказ создан».
- **WARN** — необычная ситуация, но система продолжает работу: «внешний сервис отвечает медленно», «попытка логина с неверным паролем».
- **ERROR** — операция не выполнена, исключение, деградация функциональности.

Практический критерий:
- INFO — то, что ты хочешь видеть **в обычный день**;
- DEBUG — то, что ты хочешь видеть, когда происходит «что-то странное» и включены подробности;
- ERROR — то, что требует внимания.

## 4. Базовые правила «хорошего» логирования

**Что нужно делать**
1. Структурируй сообщения.

Плохой лог:
```java
log.info("user data: " + user);
```

Хороший:
```java
log.info("User registered: id={}, email={}", user.getId(), user.getEmail());
```

**Преимущества**
- Параметризация в SLF4J **ленивая** (строка не собирается, если уровень выключен).
- Проще искать по `id=...`, `email=...`.

2. Не логируй секреты.

Никогда не пиши в лог:
- пароли, refresh tokens, access tokens;
- CVV, полные номера карт;
- секретные ключи, private keys;
- персональные данные без политики (PII).

Если очень нужно для диагностики:
- маскируй (`****`),
- сокращай,
- используй отдельный защищённый аудит-лог с ограничением доступа.

3. Один смысл — одна запись.

Не делай «полотно» на 30 строк в одном `info`.  Лучше несколько логов на ключевых этапах, но так, чтобы их можно было коррелировать (см. MDC).

4) Логируй «что делали» и «что получилось».

Особенно вокруг интеграций и транзакций:
- начало вызова внешнего сервиса,
- тайминги,
- код ответа / результат,
- исключение с причинами.

## 5. Логер в коде: что ставить в каждый класс

Классика:
```java
public class PaymentService {
    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);

    public void pay(Long ord
    
    erId) {
        log.info("Payment started: orderId={}", orderId);
        // ...
    }
}
```

С Lombok:
```java
@Slf4j
@Service
public class PaymentService {
    public void pay(Long orderId) {
        log.info("Payment started: orderId={}", orderId);
    }
}
```

## 6. Настройка в Spring Boot: application. Yml + logback-spring. Xml

### 6.1. Быстрая настройка в `application.yml`
```yaml
logging:
  level:
    root: INFO
    org.springframework.web: INFO
    org.hibernate.SQL: WARN
    com.example.demo: DEBUG
  pattern:
    console: "%d{yyyy-MM-dd HH:mm:ss.SSS} %-5level [%thread] %logger{36} trace=%X{traceId} - %msg%n"
```

### 6.2. Производственная настройка: Logback + ротация файлов
Создай `src/main/resources/logback-spring.xml`:

```xml
<configuration>

    <property name="LOG_DIR" value="./logs"/>
    <property name="APP_NAME" value="demo-app"/>

    <appender name="CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
        <encoder>
            <pattern>%d{yyyy-MM-dd HH:mm:ss.SSS} %-5level [%thread] %logger{36} trace=%X{traceId} - %msg%n</pattern>
        </encoder>
    </appender>

    <appender name="FILE" class="ch.qos.logback.core.rolling.RollingFileAppender">
        <file>${LOG_DIR}/${APP_NAME}.log</file>
        <rollingPolicy class="ch.qos.logback.core.rolling.TimeBasedRollingPolicy">
            <fileNamePattern>${LOG_DIR}/${APP_NAME}.%d{yyyy-MM-dd}.%i.log.gz</fileNamePattern>
            <timeBasedFileNamingAndTriggeringPolicy
                class="ch.qos.logback.core.rolling.SizeAndTimeBasedFNATP">
                <maxFileSize>50MB</maxFileSize>
            </timeBasedFileNamingAndTriggeringPolicy>
            <maxHistory>14</maxHistory>
            <totalSizeCap>2GB</totalSizeCap>
        </rollingPolicy>
        <encoder>
            <pattern>%d{yyyy-MM-dd HH:mm:ss.SSS} %-5level [%thread] %logger{36} trace=%X{traceId} - %msg%n</pattern>
        </encoder>
    </appender>

    <root level="INFO">
        <appender-ref ref="CONSOLE"/>
        <appender-ref ref="FILE"/>
    </root>

    <!-- Пример: подавить шум -->
    <logger name="org.springframework" level="INFO"/>
    <logger name="org.hibernate.SQL" level="WARN"/>
</configuration>
```

**Лучшие практики**
- Всегда включай **ротацию** (time + size).
- Храни логи ограниченное время.
- Держи уровни библиотек ниже (WARN/ERROR), чтобы не тонуть.

## 7. Исключения: как логировать правильно

### 7.1. Не теряй stacktrace
Плохо:
```java
log.error("Failed: " + e.getMessage());
```

Правильно:
```java
log.error("Payment failed: orderId={}", orderId, e);
```

### 7.2. Глобальный обработчик исключений + единообразные ответы
```java
@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handle(Exception e, HttpServletRequest req) {
        String path = req.getRequestURI();
        log.error("Unhandled exception: path={}", path, e);

        return ResponseEntity.status(500).body(new ApiError("INTERNAL_ERROR"));
    }

    public record ApiError(String code) {}
}
```

**Идея**: логировать в одном месте, не плодить `log.error` на каждом уровне.

## 8. Корреляция запросов: MDC и traceId

Когда у тебя микросервисы или просто несколько потоков обработки, важно видеть цепочку событий. Для этого используется **MDC** (Mapped Diagnostic Context): ты кладёшь `traceId` в контекст, и он появляется во всех логах внутри запроса.

### 8.1. Фильтр, который добавляет traceId
```java
@Component
public class TraceIdFilter extends OncePerRequestFilter {

    private static final String TRACE_ID = "traceId";

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        String traceId = Optional.ofNullable(request.getHeader("X-Trace-Id"))
                .filter(s -> !s.isBlank())
                .orElse(UUID.randomUUID().toString());

        MDC.put(TRACE_ID, traceId);
        response.setHeader("X-Trace-Id", traceId);

        try {
            filterChain.doFilter(request, response);
        } finally {
            MDC.remove(TRACE_ID);
        }
    }
}
```

Теперь pattern `%X{traceId}` начнёт работать.

### 8.2. Важно: асинхронщина
Если ты используешь `@Async`, `CompletableFuture`, очереди — MDC может не «перетечь».
В проде для этого используют:
- Spring Cloud Sleuth (устаревал в новых версиях),
- Micrometer Tracing (актуально)
- или task decorators для переноса MDC.

## 9. Логи HTTP-запросов/ответов: осторожно

Очень хочется логировать всё тело запроса и ответа, но это:
- риски утечки персональных данных,
- огромный объём,
- падение производительности.

### 9.1. Минимальный разумный HTTP access log (как у nginx)
Сделай «короткий» лог на каждый запрос: метод, путь, статус, время.

```java
@Component
public class RequestTimingFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RequestTimingFilter.class);

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        long start = System.currentTimeMillis();
        try {
            filterChain.doFilter(request, response);
        } finally {
            long ms = System.currentTimeMillis() - start;
            log.info("HTTP {} {} -> status={} timeMs={}",
                    request.getMethod(),
                    request.getRequestURI(),
                    response.getStatus(),
                    ms);
        }
    }
}
```

**Лучшее применение**: быстро видеть медленные запросы и 5xx.

### 9.2. Когда логировать тело
Только:
- на DEV/QA,
- выборочно (по feature-flag),
- с маскированием полей (password, token, card и так далее),
- ограничением размера.

## 10. Структурированные логи (JSON) для ELK/Graylog/Splunk

Если логи собираются централизованно, **JSON-логи** дают огромный выигрыш: поиск по полям, дешёвые алерты, корреляция.

Концептуально:
- вместо текста “User registered: id=1” ты пишешь JSON с полями `event=user_registered`, `userId=1`, `traceId=...`.

В Logback это обычно делается через logstash encoder (зависимость), но даже без него дисциплина “ключ=значение” уже помогает.

## 11. Best Practices чек-лист

1. Используй SLF4J + Logback (или Log4j2) — без `println`.
2. Логи параметризуй `{}`.
3. Уровни:
    - INFO — бизнес-события и жизненные точки,
    - WARN — подозрительное/необычное,
    - ERROR — сбой операции,
    - DEBUG/TRACE — диагностика, включается временно.
4. Не логируй секреты и PII без политики. Маскируй.
5. Делай **корреляцию** (traceId) через MDC.
6. Делай **access log**: метод, путь, статус, latency.
7. Ротация файлов, ограничение хранения, подавление шумных логеров.
8. Ошибки логируй с exception-объектом (`log.error(..., e)`), а не только `message`.
9. Для продакшена: централизованный сбор + поиск (ELK/Opensearch/Graylog).

