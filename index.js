/* eslint-disable no-console */
// импорт стандартных библиотек Node.js
const { existsSync, readFileSync, writeFileSync } = require('fs');
const { createServer } = require('http');

// файл для базы данных
const DB_FILE = process.env.DB_FILE || './db.json';
// номер порта, на котором будет запущен сервер
const PORT = process.env.PORT || 3000;
// префикс URI для всех методов приложения
const URI_PREFIX = '/api/goods';

/**
 * Класс ошибки, используется для отправки ответа с определённым кодом и описанием ошибки
 */
class ApiError extends Error {
  constructor(statusCode, data) {
    super();
    this.statusCode = statusCode;
    this.data = data;
  }
}

/**
 * Асинхронно считывает тело запроса и разбирает его как JSON
 * @param {Object} req - Объект HTTP запроса
 * @throws {ApiError} Некорректные данные в аргументе
 * @returns {Object} Объект, созданный из тела запроса
 */
function drainJson(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      resolve(JSON.parse(data));
    });
  });
}

/**
 * Проверяет входные данные и создаёт из них корректный объект товара
 * @param {Object} data - Объект с входными данными
 * @throws {ApiError} Некорректные данные в аргументе (statusCode 422)
 * @returns {{ title: string, description: string, price: number, discount: number, count: number, units: string, images: [] }} Объект товара
 */
function makeGoodsFromData(data) {
  const errors = [];

  function asString(str) {
    return str && String(str).trim() || '';
  }

  function isNumber(num) {
    return !Number.isNaN(parseFloat(num)) && isFinite(num)
  }

  // составляем объект, где есть только необходимые поля
  const goods = {
    title: asString(data.title),
    description: asString(data.description),
    price: data.price,
    discount: data.discount || 0,
    count: data.count,
    units: asString(data.units),
    images: [{
      "small": data?.images?.small,
      "big": data?.images?.big
    }]
  };

  // проверяем, все ли данные корректные и заполняем объект ошибок, которые нужно отдать клиенту
  if (!goods.title) errors.push({ field: 'title', message: 'Не указано название товара' });
  if (!goods.description) errors.push({ field: 'description', message: 'Не указано описание' });
  if (!isNumber(goods.price)) errors.push({ field: 'price', message: 'Не указана цена' });
  if (!isNumber(goods.count)) errors.push({ field: 'count', message: 'Не указано кол-во' });
  if (!goods.units) errors.push({ field: 'units', message: 'Не указаны ед. измерения' });

  // если есть ошибки, то бросаем объект ошибки с их списком и 422 статусом
  if (errors.length) throw new ApiError(422, { errors });

  return goods;
}

/**
 * Возвращает список товаров из базы данных
 * @param {{ search: string }} [params] - Поисковая строка
 * @returns {{ title: string, description: string, price: number, discount: number, count: number, units: string, images: [] }[]} Массив товаров
 */
function getGoodsList(params = {}) {
  const goods = JSON.parse(readFileSync(DB_FILE) || '[]');
  if (params.search) {
    const search = params.search.trim().toLowerCase();
    return goods.filter(goods => [
      goods.title,
      goods.description,
      ]
        .some(str => str.toLowerCase().includes(search))
    );
  }
  return goods;
}

/**
 * Создаёт и сохраняет товар в базу данных
 * @throws {ApiError} Некорректные данные в аргументе, товар не создан (statusCode 422)
 * @param {Object} data - Данные из тела запроса
 * @returns {{ title: string, description: string, price: number, discount: number, count: number, units: string, images: [] }} Объект клиента
 */
function createGoods(data) {
  const newItem = makeGoodsFromData(data);
  newItem.id = Math.random().toString().substring(2, 8) + Date.now().toString().substring(9);
  writeFileSync(DB_FILE, JSON.stringify([...getGoodsList(), newItem]), { encoding: 'utf8' });
  return newItem;
}

/**
 * Возвращает объект товара по его ID
 * @param {string} itemId - ID товара
 * @throws {ApiError} Товар с таким ID не найден (statusCode 404)
 * @returns {{id: string, title: string, description: string, price: number, discount: number, count: number, units: string, images: [] }} Объект клиента
 */
function getGoods(itemId) {
  const goods = getGoodsList().find(({ id }) => id === itemId);
  if (!goods) throw new ApiError(404, { message: 'Goods Not Found' });
  return goods;
}

/**
 * Изменяет товар с указанным ID и сохраняет изменения в базу данных
 * @param {string} itemId - ID изменяемого товара
 * @param {{title?: string, description?: string, price?: number, discount?: number, count?: number, units?: string, images?: [] }} data - Объект с изменяемыми данными
 * @throws {ApiError} Товар с таким ID не найден (statusCode 404)
 * @throws {ApiError} Некорректные данные в аргументе (statusCode 422)
 * @returns {{id: string, title: string, description: string, price: number, discount: number, count: number, units: string, images: [] }} Объект товара
 */
function updateGoods(itemId, data) {
  const goods = getGoodsList();
  const itemIndex = goods.findIndex(({ id }) => id === itemId);
  if (itemIndex === -1) throw new ApiError(404, { message: 'Goods Not Found' });
  Object.assign(goods[itemIndex], makeGoodsFromData({ ...goods[itemIndex], ...data }));
  writeFileSync(DB_FILE, JSON.stringify(goods), { encoding: 'utf8' });
  return goods[itemIndex];
}

/**
 * Удаляет товар из базы данных
 * @param {string} itemId - ID товара
 * @returns {{}}
 */
function deleteGoods(itemId) {
  const goods = getGoodsList();
  const itemIndex = goods.findIndex(({ id }) => id === itemId);
  if (itemIndex === -1) throw new ApiError(404, { message: 'Goods Not Found' });
  goods.splice(itemIndex, 1);
  writeFileSync(DB_FILE, JSON.stringify(goods), { encoding: 'utf8' });
  return {};
}

// создаём новый файл с базой данных, если он не существует
if (!existsSync(DB_FILE)) writeFileSync(DB_FILE, '[]', { encoding: 'utf8' });

// создаём HTTP сервер, переданная функция будет реагировать на все запросы к нему
module.exports = createServer(async (req, res) => {
  // req - объект с информацией о запросе, res - объект для управления отправляемым ответом

  // этот заголовок ответа указывает, что тело ответа будет в JSON формате
  res.setHeader('Content-Type', 'application/json');

  // CORS заголовки ответа для поддержки кросс-доменных запросов из браузера
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // запрос с методом OPTIONS может отправлять браузер автоматически для проверки CORS заголовков
  // в этом случае достаточно ответить с пустым телом и этими заголовками
  if (req.method === 'OPTIONS') {
    // end = закончить формировать ответ и отправить его клиенту
    res.end();
    return;
  }

  // если URI не начинается с нужного префикса - можем сразу отдать 404
  if (!req.url || !req.url.startsWith(URI_PREFIX)) {
    res.statusCode = 404;
    res.end(JSON.stringify({ message: 'Not Found' }));
    return;
  }

  // убираем из запроса префикс URI, разбиваем его на путь и параметры
  const [uri, query] = req.url.substring(URI_PREFIX.length).split('?');
  const queryParams = {};

  // параметры могут отсутствовать вообще или иметь вид a=b&b=c
  // во втором случае наполняем объект queryParams { a: 'b', b: 'c' }
  if (query) {
    for (const piece of query.split('&')) {
      const [key, value] = piece.split('=');
      queryParams[key] = value ? decodeURIComponent(value) : '';
    }
  }

  try {
    // обрабатываем запрос и формируем тело ответа
    const body = await (async () => {
      if (uri === '' || uri === '/') {
        // /api/goods
        if (req.method === 'GET') return getGoodsList(queryParams);
        if (req.method === 'POST') {
          const createdItem = createGoods(await drainJson(req));
          res.statusCode = 201;
          res.setHeader('Access-Control-Expose-Headers', 'Location');
          res.setHeader('Location', `${URI_PREFIX}/${createdItem.id}`);
          return createdItem;
        }
      } else {
        // /api/goods/{id}
        // параметр {id} из URI запроса
        const itemId = uri.substring(1);
        if (req.method === 'GET') return getGoods(itemId);
        if (req.method === 'PATCH') return updateGoods(itemId, await drainJson(req));
        if (req.method === 'DELETE') return deleteGoods(itemId);
      }
      return null;
    })();
    res.end(JSON.stringify(body));
  } catch (err) {
    // обрабатываем сгенерированную нами же ошибку
    if (err instanceof ApiError) {
      res.writeHead(err.statusCode);
      res.end(JSON.stringify(err.data));
    } else {
      // если что-то пошло не так - пишем об этом в консоль и возвращаем 500 ошибку сервера
      res.statusCode = 500;
      res.end(JSON.stringify({ message: 'Server Error' }));
      console.error(err);
    }
  }
})
  // выводим инструкцию, как только сервер запустился...
  .on('listening', () => {
    if (process.env.NODE_ENV !== 'test') {
      console.log(`Сервер CRM запущен. Вы можете использовать его по адресу http://localhost:${PORT}`);
      console.log('Нажмите CTRL+C, чтобы остановить сервер');
      console.log('Доступные методы:');
      console.log(`GET ${URI_PREFIX} - получить список товаров, в query параметр search можно передать поисковый запрос`);
      console.log(`POST ${URI_PREFIX} - создать товар, в теле запроса нужно передать объект {title: string, description: string, price: number, discount?: number, count: number, units: string, images?: [] }`);
      console.log(`GET ${URI_PREFIX}/{id} - получить товар по его ID`);
      console.log(`PATCH ${URI_PREFIX}/{id} - изменить товар с ID, в теле запроса нужно передать объект {title: string, description: string, price: number, discount?: number, count: number, units: string, images?: [] }`);
      console.log(`DELETE ${URI_PREFIX}/{id} - удалить товар по ID`);
    }
  })
  // ...и вызываем запуск сервера на указанном порту
  .listen(PORT);
