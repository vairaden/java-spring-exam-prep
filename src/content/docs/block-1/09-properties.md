---
title: "9. Properties и конфигурация"
description: "@Value, @PropertySource, @ConfigurationProperties, application.properties/yaml"
---

> Properties. @Value. @PropertySource. @ConfigurationProperties. Файлы конфигурации application.properties и application.yaml.

## Внешняя конфигурация

Spring Boot собирает свойства из множества источников с приоритетом (от низшего к высшему):
`application.yaml`/`.properties` → профильные файлы → переменные окружения → системные
свойства JVM → аргументы командной строки. Это позволяет переопределять настройки без
пересборки.

## application.properties и application.yaml

Два формата одного и того же. YAML удобнее для вложенных структур и списков:
```properties
# application.properties
app.name=ToDo
app.upload-dir=/data/uploads
```
```yaml
# application.yaml
app:
  name: ToDo
  upload-dir: /data/uploads
  api-version: v1
```
Профильные файлы: `application-dev.yaml`, `application-prod.yaml` — подхватываются при
активном профиле и переопределяют базовый `application.yaml`.

## @Value

Внедряет **одно** свойство (с поддержкой SpEL и значения по умолчанию):
```java
@Value("${app.name}") private String name;
@Value("${app.timeout:5000}") private int timeout; // 5000 — дефолт
@Value("#{systemProperties['user.home']}") private String home; // SpEL
```
Подходит для точечных значений; для групп свойств громоздок.

## @PropertySource

Подключает **дополнительный** `.properties`-файл к `Environment` (для не-Boot или кастомных
файлов; YAML напрямую не поддерживает):
```java
@Configuration
@PropertySource("classpath:custom.properties")
public class CustomConfig {}
```

## @ConfigurationProperties

**Типобезопасная** привязка целой группы свойств к полям объекта (релаксированный binding:
`upload-dir` → `uploadDir`). Рекомендуемый способ для наборов настроек:
```java
@ConfigurationProperties(prefix = "app")
@Validated
public class AppProperties {
    private String name;
    private String uploadDir;
    @NotNull private String apiVersion;
    // геттеры/сеттеры
}
```
Активация: `@EnableConfigurationProperties(AppProperties.class)` или
`@ConfigurationPropertiesScan`. Затем класс внедряется как обычный бин:
```java
public TaskService(AppProperties props) { this.dir = props.getUploadDir(); }
```

## @Value vs @ConfigurationProperties

| | @Value | @ConfigurationProperties |
|---|---|---|
| Назначение | одно значение | группа свойств |
| Тип-безопасность | слабая | сильная, с валидацией |
| Релаксированный binding | нет | да (`kebab` → `camelCase`) |
| SpEL | да | нет |

Правило: единичные значения — `@Value`; наборы связанных настроек — `@ConfigurationProperties`.

## 🔗 Смежные вопросы
- [Б1.8 — Аннотации конфигураций (@Profile)](/block-1/08-config-annotations/)
- [Б2.2 — Spring JDBC, DataSource](/block-2/02-spring-jdbc/)

## 📚 Материалы
- [Лонгрид 3 — Стереотипные аннотации и конфигурирование](/longreads/03-stereotypes-config/)
