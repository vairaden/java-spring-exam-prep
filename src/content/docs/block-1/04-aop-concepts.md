---
title: "4. AOP: основные понятия"
description: "Join Point, Pointcut, Advice, Aspect"
---

> AOP. Понятия: Join Point, Pointcut, Advice, Aspect.

## Что такое AOP

**Аспектно-ориентированное программирование (AOP)** решает проблему **сквозной
функциональности (cross-cutting concerns)** — логики, которая нужна во многих местах, но
не относится к бизнес-задаче: логирование, транзакции, безопасность, кеширование, метрики.
Без AOP такой код дублируется по всем методам. AOP позволяет вынести его в одно место и
«вплести» в нужные точки.

## Ключевые понятия

**Join Point (точка соединения)** — место в выполнении программы, куда **можно** вмешаться.
В Spring AOP join point — это всегда **вызов метода бина**.

**Pointcut (срез)** — выражение-предикат, отбирающее, **какие именно** join points
перехватывать. Записывается на pointcut-языке AspectJ:
```java
@Pointcut("execution(* com.example.service.*.*(..))") // все методы всех классов в пакете service
public void serviceMethods() {}
```
Часто используемые designator'ы: `execution(...)`, `within(...)`, `@annotation(...)`, `bean(...)`, `args(...)`.

**Advice (совет)** — **что** делать и **когда** относительно join point. Виды advice:
- `@Before` — до вызова метода;
- `@AfterReturning` — после успешного возврата (доступен результат);
- `@AfterThrowing` — при выбросе исключения;
- `@After` — в любом случае (finally);
- `@Around` — оборачивает вызов, сам решает вызывать ли `proceed()`, может менять аргументы/результат.

```java
@Around("serviceMethods()")
public Object logTiming(ProceedingJoinPoint pjp) throws Throwable {
    long t = System.currentTimeMillis();
    Object result = pjp.proceed();          // вызов целевого метода
    log.info("{} took {} ms", pjp.getSignature(), System.currentTimeMillis() - t);
    return result;
}
```

**Aspect (аспект)** — модуль, объединяющий pointcut'ы и advice'ы. В Spring это класс с
`@Aspect` и `@Component`:
```java
@Aspect
@Component
public class LoggingAspect {
    @Before("execution(* com.example.service.*.*(..))")
    public void logCall(JoinPoint jp) { log.info("call {}", jp.getSignature()); }
}
```

Дополнительно: **Weaving** — процесс «вплетения» аспектов в целевой код (см. вопрос 5);
**Introduction** — добавление аспектом новых методов/интерфейсов к классу.

## 🔗 Смежные вопросы
- [Б1.5 — Spring AOP и прокси](/block-1/05-aop-proxies/)
- [Б1.6 — Жизненный цикл бина](/block-1/06-bean-lifecycle/)
- [Б2.3 — Транзакции (@Transactional через AOP)](/block-2/03-transactions/)

## 📚 Материалы
- [Лонгрид 2 — Жизненный цикл бинов](/longreads/02-bean-lifecycle/) — прокси создаются на этапе инициализации
- [Лонгрид 3 — Стереотипные аннотации и конфигурирование](/longreads/03-stereotypes-config/)
