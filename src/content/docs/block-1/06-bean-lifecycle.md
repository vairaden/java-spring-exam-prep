---
title: "6. Bean. Жизненный цикл"
description: "Этапы создания, инициализации и уничтожения бина в IoC-контейнере"
---

> Bean. Жизненный цикл.

## Что такое бин

**Бин** — объект, которым управляет IoC-контейнер Spring: контейнер его создаёт,
конфигурирует, связывает и уничтожает. Информация о бине хранится в `BeanDefinition`
(класс, scope, зависимости, init/destroy-методы).

## Этапы жизненного цикла

1. **Загрузка определений** — сканирование/чтение конфигурации → `BeanDefinition`.
2. **Инстанцирование** — контейнер создаёт объект (вызов конструктора, внедрение
   constructor-зависимостей).
3. **Заполнение свойств (populate)** — внедрение зависимостей через поля/сеттеры.
4. **Aware-интерфейсы** — если бин их реализует, вызываются: `BeanNameAware.setBeanName()`,
   `BeanFactoryAware`, `ApplicationContextAware` и т.д. (бин получает доступ к инфраструктуре).
5. **`BeanPostProcessor.postProcessBeforeInitialization()`** — для каждого BPP, до инициализации.
6. **Инициализация** в порядке:
   - метод с `@PostConstruct`;
   - `InitializingBean.afterPropertiesSet()`;
   - кастомный `init-method` (`@Bean(initMethod="...")`).
7. **`BeanPostProcessor.postProcessAfterInitialization()`** — здесь часто создаются **прокси**
   (AOP, `@Transactional`): BPP может вернуть обёртку вместо исходного бина.
8. **Бин готов** — живёт в контейнере, используется приложением.
9. **Уничтожение** (при закрытии контекста, для singleton):
   - метод с `@PreDestroy`;
   - `DisposableBean.destroy()`;
   - кастомный `destroy-method`.

```java
@Component
public class TaskService implements InitializingBean, DisposableBean {
    @PostConstruct void warmUp() { /* прогрев кеша */ }
    @Override public void afterPropertiesSet() { /* проверка инвариантов */ }
    @PreDestroy void flush() { /* сброс буфера */ }
    @Override public void destroy() { /* освобождение ресурсов */ }
}
```

## Важные нюансы

- **Порядок init-хуков**: `@PostConstruct` → `afterPropertiesSet()` → `initMethod`.
- **Destroy-хуки вызываются только для singleton-бинов**; для `prototype` контейнер не
  управляет уничтожением (об этом заботится клиент).
- **`BeanPostProcessor` vs `BeanFactoryPostProcessor`**: BFPP правит `BeanDefinition` (метаданные)
  до создания бинов; BPP работает с уже созданными экземплярами.
- Рекомендуется использовать **`@PostConstruct`/`@PreDestroy`** (JSR-250) вместо
  интерфейсов Spring — меньше связанности с фреймворком.

## 🔗 Смежные вопросы
- [Б1.2 — IoC и DI](/block-1/02-ioc-di/)
- [Б1.7 — Стереотипы и скоупы](/block-1/07-bean-scopes/)
- [Б1.5 — Spring AOP и прокси (создаются в BPP)](/block-1/05-aop-proxies/)

## 📚 Материалы
- [Лонгрид 2 — Жизненный цикл бинов](/longreads/02-bean-lifecycle/)
