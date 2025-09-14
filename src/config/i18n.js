const i18next = require('i18next');
const i18nextMiddleware = require('i18next-http-middleware');
const FsBackend = require('i18next-fs-backend');
const path = require('path');

i18next
  .use(FsBackend)
  .use(i18nextMiddleware.LanguageDetector)
  .init({
    backend: {
      loadPath: path.join(__dirname, '../../locales/{{lng}}/{{ns}}.json'),
    },
    fallbackLng: 'en',
    ns: ['translation'],
    defaultNS: 'translation',
    detection: {
      order: ['querystring', 'jwt', 'header'],
      lookupQuerystring: 'lang',
      lookupHeader: 'accept-language',
      lookupJwt: 'language',
    },
  });

module.exports = i18next;
