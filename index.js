/* eslint-disable no-console */
// импорт стандартных библиотек Node.js
const {existsSync, mkdirSync, readFileSync, writeFileSync, writeFile} = require('fs');
const {createServer} = require('http');

// файл для базы данных
const DB_GOODS = process.env.DB_GOODS || './db_goods.json';
// номер порта, на котором будет запущен сервер
const PORT = process.env.PORT || 3000;
// префикс URI для всех методов приложения
const URI_GOODS = '/api/goods';
const URI_CATEGORY = '/api/category';

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


function isImageBase64(data) {
  return (/^data:image/).test(data);
}

function isImageURL(data) {
  return (/^image\//).test(data)
}

function dataURLtoFile(base64, id) {
  if (!existsSync('./image')){
    mkdirSync('./image');
  }
  const format = base64.split(';')[0].split('/')[1];
  const ext = format === 'svg+xml' ? 'svg' : format === 'jpeg' ? 'jpg' : format;
  const base64Image = base64.split(';base64,').pop();
  writeFile(`./image/${id}.${ext}`, base64Image, {encoding: 'base64'}, (err) => {
    if (err) console.log(err);
  });
  return `image/${id}.${ext}`
}

/**
 * Проверяет входные данные и создаёт из них корректный объект товара
 * @param {Object} data - Объект с входными данными
 * @throws {ApiError} Некорректные данные в аргументе (statusCode 422)
 * @returns {{ title: string, description: string, price: number, discount: number, count: number, units: string, images: string }} Объект товара
 */
function makeGoodsFromData(data, id) {
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
    image: data.image,
    category: data.category,
  };

  // проверяем, все ли данные корректные и заполняем объект ошибок, которые нужно отдать клиенту
  if (!goods.title) errors.push({field: 'title', message: 'Не указано название товара'});
  if (!goods.description) errors.push({field: 'description', message: 'Не указано описание'});
  if (!isNumber(goods.price)) errors.push({field: 'price', message: 'Не указана цена'});
  if (!isNumber(goods.count)) errors.push({field: 'count', message: 'Не указано кол-во'});
  if (!goods.units) errors.push({field: 'units', message: 'Не указаны ед. измерения'});
  if (!goods.category) errors.push({field: 'category', message: 'Не указана категория товара'});
  // если есть ошибки, то бросаем объект ошибки с их списком и 422 статусом
  if (errors.length) throw new ApiError(422, {errors});


  if (isImageBase64(goods.image)) {
    const url = dataURLtoFile(goods.image, id);
    goods.image = url;
  } else if (!isImageURL(goods.image)) {
    goods.image = 'image/notimage.jpg';
  }

  return goods;
}

/**
 * Возвращает список категорий из базы данных
 * @returns {{ title: string, rus: string}[]} Массив Категорий
 */
function getCategoryList() {
    const goods = JSON.parse(readFileSync(DB_GOODS) || "[]");
    const category = [...new Set(goods.map(item => item.category))];
    return category;

}


/**
 * Возвращает список дисконтных товаров из базы данных
 * @returns {{ title: string, description: string, price: number, discount: number, count: number, units: string, images: string }[]} Массив товаров
 */
function getDiscountList() {
  const goods = JSON.parse(readFileSync(DB_GOODS) || '[]');
  return goods.filter(item => item.discount);
}


/**
 * Возвращает список товаров из базы данных
 * @param {{ search: string }} [params] - Поисковая строка
 * @returns {{ title: string, description: string, price: number, discount: number, count: number, units: string, images: string }[]} Массив товаров
 */
function getGoodsList(params = {}) {
  const goods = JSON.parse(readFileSync(DB_GOODS) || '[]');
  if (params.search) {
    const search = params.search.trim().toLowerCase();
    return goods.filter(goods => [
        goods.title,
        goods.description,
      ].some(str => str.toLowerCase().includes(search))
    );
  }
  return goods;
}


/**
 * Возвращает список товаров по категориям из базы данных
 * @returns {{ title: string, description: string, price: number, discount: number, count: number, units: string, images: string }[]} Массив товаров
 */
function getGoodsCategorytList(category) {
  console.log('category: ', category);
  if (!category) return getGoodsList();
  const goods = JSON.parse(readFileSync(DB_GOODS) || '[]');
  if (!goods) throw new ApiError(404, {message: 'Goods Not Found'});
  return goods.filter(item => decodeURI(item.category) === decodeURI(category));
}



/**
 * Создаёт и сохраняет товар в базу данных
 * @throws {ApiError} Некорректные данные в аргументе, товар не создан (statusCode 422)
 * @param {Object} data - Данные из тела запроса
 * @returns {{ title: string, description: string, price: number, discount: number, count: number, units: string, images: string }} Объект клиента
 */
function createGoods(data) {
  const id = Math.random().toString().substring(2, 8) + Date.now().toString().substring(9)
  const newItem = makeGoodsFromData(data, id);
  newItem.id = id;
  writeFileSync(DB_GOODS, JSON.stringify([...getGoodsList(), newItem]), {encoding: 'utf8'});
  return newItem;
}

/**
 * Возвращает объект товара по его ID
 * @param {string} itemId - ID товара
 * @throws {ApiError} Товар с таким ID не найден (statusCode 404)
 * @returns {{id: string, title: string, description: string, price: number, discount: number, count: number, units: string, images: string }} Объект клиента
 */
function getGoods(itemId) {
  const goods = getGoodsList().find(({id}) => id === itemId);
  if (!goods) throw new ApiError(404, {message: 'Goods Not Found'});
  return goods;
}

/**
 * Изменяет товар с указанным ID и сохраняет изменения в базу данных
 * @param {string} itemId - ID изменяемого товара
 * @param {{title?: string, description?: string, price?: number, discount?: number, count?: number, units?: string, images?: string }} data - Объект с изменяемыми данными
 * @throws {ApiError} Товар с таким ID не найден (statusCode 404)
 * @throws {ApiError} Некорректные данные в аргументе (statusCode 422)
 * @returns {{id: string, title: string, description: string, price: number, discount: number, count: number, units: string, images: string }} Объект товара
 */
function updateGoods(itemId, data) {
  const goods = getGoodsList();
  const itemIndex = goods.findIndex(({id}) => id === itemId);
  if (itemIndex === -1) throw new ApiError(404, {message: 'Goods Not Found'});
  Object.assign(goods[itemIndex], makeGoodsFromData({...goods[itemIndex], ...data}, itemId));
  writeFileSync(DB_GOODS, JSON.stringify(goods), {encoding: 'utf8'});
  return goods[itemIndex];
}

/**
 * Удаляет товар из базы данных
 * @param {string} itemId - ID товара
 * @returns {{}}
 */
function deleteGoods(itemId) {
  const goods = getGoodsList();
  const itemIndex = goods.findIndex(({id}) => id === itemId);
  if (itemIndex === -1) throw new ApiError(404, {message: 'Goods Not Found'});
  goods.splice(itemIndex, 1);
  writeFileSync(DB_GOODS, JSON.stringify(goods), {encoding: 'utf8'});
  return {};
}


// создаём новый файл с базой данных, если он не существует
if (!existsSync(DB_GOODS)) writeFileSync(DB_GOODS, '[]', {encoding: 'utf8'});

// создаём HTTP сервер, переданная функция будет реагировать на все запросы к нему
module.exports = createServer(async (req, res) => {
  // req - объект с информацией о запросе, res - объект для управления отправляемым ответом

  if  (req.url.substring(1, 6) === 'image') {
    res.statusCode = 200;
    res.setHeader("Content-Type", "image/jpeg");
    require("fs").readFile(`.${req.url}`, (err, image) => {
      res.end(image);
    });
    return;
  }

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
  if (!req.url || (!req.url.startsWith(URI_GOODS) && !req.url.startsWith(URI_CATEGORY))) {
    res.statusCode = 404;
    res.end(JSON.stringify({message: 'Not Found'}));
    return;
  }

  let data = null;
  // убираем из запроса префикс URI, разбиваем его на путь и параметры
  if (req.url.startsWith(URI_CATEGORY)) {
    data = [URI_CATEGORY];
  }
  if (req.url.startsWith(URI_GOODS)) {
    data = req.url.substring(URI_GOODS.length).split('?');
  }
  const [uri, query] = data;
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
      if (uri === URI_CATEGORY) {
        if (req.method === 'GET') return getCategoryList();
      }
      if (uri === '/discount') {
        return getDiscountList();
      }
      if (/^\/category\/*/.test(uri)) {
        return getGoodsCategorytList(uri.replace(/^\/category\//, ''));
      }
      if (uri === '' || uri === '/') {
        // /api/goods
        if (req.method === 'GET') return getGoodsList(queryParams);
        if (req.method === 'POST') {
          const createdItem = createGoods(await drainJson(req));
          res.statusCode = 201;
          res.setHeader('Access-Control-Expose-Headers', 'Location');
          res.setHeader('Location', `${URI_GOODS}/${createdItem.id}`);
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
      res.end(JSON.stringify({message: 'Server Error'}));
      console.error(err);
    }
  }
})
  // выводим инструкцию, как только сервер запустился...
  .on('listening', () => {
    if (process.env.NODE_ENV !== 'test') {
      console.log(`Сервер CMS запущен. Вы можете использовать его по адресу http://localhost:${PORT}`);
      console.log('Нажмите CTRL+C, чтобы остановить сервер');
      console.log('Доступные методы:');
      console.log(`GET ${URI_GOODS} - получить список товаров, в query параметр search можно передать поисковый запрос`);
      console.log(`POST ${URI_GOODS} - создать товар, в теле запроса нужно передать объект {title: string, description: string, price: number, discount?: number, count: number, units: string, images?: string }`);
      console.log(`GET ${URI_GOODS}/{id} - получить товар по его ID`);
      console.log(`PATCH ${URI_GOODS}/{id} - изменить товар с ID, в теле запроса нужно передать объект {title: string, description: string, price: number, discount?: number, count: number, units: string, images?: string }`);
      console.log(`DELETE ${URI_GOODS}/{id} - удалить товар по ID`);
      console.log(`GET ${URI_GOODS}/discount - получить список дисконтных товаров`);
      console.log(`GET ${URI_GOODS}/category/{category} - получить список товаров по категории`);
      console.log(`GET ${URI_CATEGORY} - получить список категорий`);

    }
  })
  // ...и вызываем запуск сервера на указанном порту
  .listen(PORT);
