# **Проект: API для управления товарами**

Этот проект представляет собой Node.js приложение, которое предоставляет API для управления товарами. Вы можете использовать это API для создания, обновления, удаления и получения информации о товарах.

## **Установка и настройка**

1. Убедитесь, что у вас установлен Node.js. Если его нет, вы можете скачать его с **[официального сайта Node.js](https://nodejs.org/)**.
2. Склонируйте репозиторий:

   ```bash
   git clone <repository_url>

   ```

3. Перейдите в каталог проекта:

   ```bash
   cd <project_directory>

   ```

4. Установите зависимости:

   ```bash
   npm install

   ```

## **Запуск приложения**

Вы можете запустить приложение с помощью следующей команды:

```bash
npm start

```

Приложение будет запущено на порту 3000 по умолчанию. Вы можете настроить порт, установив переменную окружения **`PORT`**.

```
PORT=5000 npm start

```

## **Использование API**

### **Получение списка товаров**

- **Метод**: GET
- **URL**: /api/goods
- **Параметры**:
  - **`page`** (необязательный) - номер страницы (по умолчанию: 1)
  - **`search`** (необязательный) - поисковый запрос для фильтрации товаров по названию или описанию

Пример запроса:

```bash
GET /api/goods?page=1&search=example

```

### **Создание нового товара**

- **Метод**: POST
- **URL**: /api/goods
- **Тело запроса**: JSON объект с данными о товаре. Обязательные поля:
  - **`title`** - название товара
  - **`description`** - описание товара
  - **`price`** - цена товара
  - **`count`** - количество товара
  - **`units`** - единицы измерения товара

Пример тела запроса:

```json
{
  "title": "Пример товара",
  "description": "Описание товара",
  "price": 19.99,
  "count": 100,
  "units": "шт."
}
```

### **Получение информации о товаре по ID**

- **Метод**: GET
- **URL**: /api/goods/{id}

Пример запроса:

```bash
GET /api/goods/123456

```

### **Обновление информации о товаре по ID**

- **Метод**: PATCH
- **URL**: /api/goods/{id}
- **Тело запроса**: JSON объект с данными для обновления. Поддерживаемые поля такие же, как при создании товара.

Пример тела запроса:

```json
{
  "price": 24.99
}
```

### **Удаление товара по ID**

- **Метод**: DELETE
- **URL**: /api/goods/{id}

Пример запроса:

```bash
DELETE /api/goods/123456

```

### **Получение списка категорий**

- **Метод**: GET
- **URL**: /api/categories

Пример запроса:

```bash
GET /api/categories

```

### **Получение общей стоимости товаров**

- **Метод**: GET
- **URL**: /api/total

Пример запроса:

```bash
GET /api/total

```

### **Получение списка дисконтных товаров**

- **Метод**: GET
- **URL**: /api/discount

Пример запроса:

```bash
GET /api/discount

```

### **Получение списка товаров по категории**

- **Метод**: GET
- **URL**: /api/category/{category}

Пример запроса:

```bash
GET /api/category/Electronics

```

## **Примеры ответов**

### **Успешный ответ**

```json
{
  "title": "Пример товара",
  "description": "Описание товара",
  "price": 19.99,
  "count": 100,
  "units": "шт."
}
```

### **Ошибка**

```json
{
  "message": "Not Found"
}
```

## **Примечания**

- Это API поддерживает CORS и может использоваться из любых доменов.
- Для сохранения изображений товаров, они должны быть в формате base64. Изображения сохраняются в каталоге **`./image`**.
- Для изменения настроек базы данных и порта, вы можете настроить соответствующие переменные окружения в файле **`.env`**.
- Важно обеспечить безопасность и авторизацию при использовании этого API в боевых условиях.

Это основная информация о проекте и его API. Вы можете настроить и использовать это приложение для управления товарами в вашем проекте. Удачи!
