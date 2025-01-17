const path = require('path');
const { promisify } = require('util');
const dotenv = require('dotenv');
const redis = require('redis');
const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const { StatusCodes } = require('http-status-codes');
const { nanoid } = require('nanoid');

const baseHATEOASLinks = require('./hateoas.json');
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

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);
app.use(cors());
app.use(morgan('tiny'));
app.use(express.json());
app.use(express.static(path.resolve(__dirname, '..', 'static')));

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
          path: '/url',
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            url: {
              type: 'string',
              required: true,
            },
          },
          response: {
            body: {
              url: {
                type: 'string',
                description: 'URL that was registered',
              },
              short: {
                type: 'string',
                description: 'URL that will redirect to the provided URL',
              },
              slug: {
                type: 'string',
                description: 'Unique identifier of the registered URL',
              },
            },
          },
        },
        ...baseHATEOASLinks._links,
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
        path: '/url',
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          url: {
            type: 'string',
            required: true,
          },
        },
        response: {
          body: {
            url: {
              type: 'string',
              description: 'URL that was registered',
            },
            short: {
              type: 'string',
              description: 'URL that will redirect to the provided URL',
            },
            slug: {
              type: 'string',
              description: 'Unique identifier of the registered URL',
            },
          },
        },
      },
      ...baseHATEOASLinks._links,
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
          path: '/url/:slug',
          pathParams: {
            slug: {
              type: 'string',
              required: true,
              description: 'The slug of the URL to redirect to',
            },
          },
        },
        ...baseHATEOASLinks._links,
      },
    });
  }

  res.redirect(url);
});

app.use((req, res, next) => {
  return res.status(StatusCodes.NOT_FOUND).json({
    error: true,
    message: `Unable to resolve path ${req.path}`,
    _links: {
      _self: {
        method: req.method,
        url: req.url,
      },
      ...baseHATEOASLinks._links,
    },
  });
});

app.listen(process.env.PORT || 8080, () => {
  console.log(`Listening on port ${process.env.PORT || 8080}`);
});
