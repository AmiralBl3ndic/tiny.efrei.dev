const { promisify } = require('util');
const dotenv = require('dotenv');
const redis = require('redis');
const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const { StatusCodes } = require('http-status-codes');
const { nanoid } = require('nanoid');

const urlRegistrationYupModel = require('./model/url-register-request.yup');

dotenv.config();

if (!process.env.REDIS_HOST) {
  throw new Error('Missing REDIS_HOST environment variable');
}

const redisClient = redis.createClient(`redis://${process.env.REDIS_HOST}`);

/**
 * Async wrapper for Redis client
 */
const store = {
  get: promisify(redisClient.get).bind(redisClient),
  set: promisify(redisClient.set).bind(redisClient),
};

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('tiny'));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: 'A simple URL reducer',
  });
});

app.post('/url', async (req, res) => {
  try {
    await urlRegistrationYupModel.validate(req.body);
  } catch (error) {
    return res.status(StatusCodes.CONFLICT).json({
      error,
      _links: {
        _self: {
          method: 'POST',
          url: '/url',
        },
        registerURL: {
          method: 'POST',
          url: '/url',
        },
        redirect: {
          path: '/url/:slug',
        },
      },
    });
  }

  /**
   * URL to register
   */
  const urlToRegister = req.body.url;
  const slug = nanoid(10);
  await store.set(slug, urlToRegister);

  res.status(StatusCodes.CREATED).json({
    slug,
    url: urlToRegister,
    short: `${req.protocol}://${req.hostname}/url/${slug}`,
    _links: {
      _self: {
        method: 'POST',
        url: '/url',
      },
      registerURL: {
        method: 'POST',
        url: '/url',
      },
      redirect: {
        path: '/url/:slug',
      },
    },
  });
});

app.all('/url/:slug', async (req, res) => {
  const url = await store.get(req.params.slug);

  if (!url) {
    return res.status(StatusCodes.NOT_FOUND).json({
      error: true,
      message: `Found no registered URL for slug ${req.params.slug}`,
      _links: {
        _self: {
          method: req.method,
          url: req.url,
        },
        registerURL: {
          method: 'POST',
          url: '/url',
        },
        redirect: {
          path: '/url/:slug',
        },
      },
    });
  }

  res.redirect(url);
});

app.listen(process.env.PORT || 8080, () => {
  console.log(`Listening on port ${process.env.PORT || 8080}`);
});
