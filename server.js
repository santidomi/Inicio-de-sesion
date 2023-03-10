const express = require('express');
const session = require('express-session');

const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

const Usuarios = require('./models/usuarios');

const bcrypt = require('bcrypt');
const routes = require('./routes');

const mongoose = require('mongoose');
const { engine } = require('express-handlebars');

const PORT = 8081;

const Toastify = require('toastify-js');
const Swal = require('sweetalert2');

const redis = require('redis');
const client = redis.createClient({
  legacyMode: true,
});
client
  .connect()
  .then(() => console.log('\x1b[32m', 'Connected to REDIS '))
  .catch((e) => {
    console.error(e);
    throw 'can not connect to Redis! ';
  });
const RedisStore = require('connect-redis')(session);

mongoose
  .connect('mongodb+srv://santiagomorera:NBLW114i2jvyU60F@cluster0.1clmwkn.mongodb.net/ecommerce')
  .then(() => console.log('\x1b[32m', 'Connected to Mongo'))
  .catch((e) => {
    console.error(e);
    throw 'can not connect to the mongo!';
  });

function isValidPassword(user, password) {
  return bcrypt.compareSync(password, user.password);
}

function createHash(password) {
  return bcrypt.hashSync(password, bcrypt.genSaltSync(10), null);
}

passport.use(
  'login',
  new LocalStrategy((username, password, done) => {
    Usuarios.findOne({ username }, (err, user) => {
      if (err) return done(err);

      if (!user) {
        console.log('User Not Found with username ' + username);
        return done(null, false);
      }

      if (!isValidPassword(user, password)) {
        console.log('Invalid Password');
        return done(null, false);
      }
      return done(null, user);
    });
  })
);

passport.use(
  'signup',
  new LocalStrategy(
    {
      passReqToCallback: true,
    },
    (req, username, password, done) => {
      Usuarios.findOne({ username: username }, function (err, user) {
        if (err) {
          console.log('Error in SignUp: ' + err);
          return done(err);
        }

        if (user) {
          console.log('User already exists');
          return done(null, false);
        }

        const newUser = {
          username: username,
          password: createHash(password),
        };
        Usuarios.create(newUser, (err, userWithId) => {
          if (err) {
            console.log('Error in Saving user: ' + err);
            return done(err);
          }
          console.log(user);
          console.log('User Registration succesful');
          return done(null, userWithId);
        });
      });
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser((id, done) => {
  Usuarios.findById(id, done);
});

const app = express();

app.use(
  session({
    store: new RedisStore({ host: 'localhost', port: 6379, client, ttl: 300 }),
    secret: 'keyboard cat',
    cookie: {
      httpOnly: false,
      secure: false,
      maxAge: 86400000, // 1 dia
    },
    admin: true,
    rolling: true,
    resave: true,
    saveUninitialized: false,
  })
);

app.use('/public', express.static(__dirname + '/public'));
app.set('view engine', 'hbs');
app.set('views', './views');
app.engine(
  'hbs',
  engine({
    extname: '.hbs',
    defaultLayout: 'index.hbs',
    layoutsDir: __dirname + '/views/layouts',
    partialsDir: __dirname + '/views/partials',
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', routes.getRoot);
app.get('/login', routes.getLogin);
app.post('/login', passport.authenticate('login', { failureRedirect: '/faillogin' }), routes.postLogin);
app.get('/faillogin', routes.getFaillogin);
app.get('/signup', routes.getSignup);
app.post('/signup', passport.authenticate('signup', { failureRedirect: '/failsignup' }), routes.postSignup);
app.get('/failsignup', routes.getFailsignup);
app.get('/logout', routes.getLogout);

function checkAuthentication(req, res, next) {
  if (req.isAuthenticated()) {
    next();
  } else {
    res.redirect('/login');
  }
}

app.get('/ruta-protegida', checkAuthentication, (req, res) => {
  const { username, password } = req.user;
  const user = { username, password };
  const admin = JSON.stringify(req.session.admin);
  res.render('private', { layout: 'logged', user, admin });
});

app.get('/form', checkAuthentication, (req, res) => {
  res.render('form', { layout: 'logged' });
});

app.get('/showsession', (req, res) => {
  const mySession = JSON.stringify(req.session, null, 4);
  req.session.touch();
  res.json(req.session);
});

app.get('/form', checkAuthentication, (req, res) => {
  res.render('form', { layout: 'logged' });
});

app.get('/products-list', async (req, res) => {
  res.render('products-list');
});

app.get('/productos-test', async (req, res) => {
  res.render('productos-test');
});

app.get('/chat', async (req, res) => {
  res.render('chat');
});

app.get('*', routes.failRoute);

const generateFakeProducts = require('./utils/fakerProductGenerator');
const FakeP = generateFakeProducts(5);

const moment = require('moment');
const timestamp = moment().format('h:mm a');

const Contenedor = require('./container/contenedor');
const ContenedorMsg = require('./container/contenedorMsg');

const contenedorProductos = new Contenedor('productos');
const productosFS = contenedorProductos.getAll();
const dataMsg = new ContenedorMsg();

const { normalize, schema } = require('normalizr');

const authorSchema = new schema.Entity('authors', {}, { idAttribute: 'email' });
const messageSchema = new schema.Entity('messages', {
  author: authorSchema,
});

const chatSchema = new schema.Entity('chats', {
  messages: [messageSchema],
});

const normalizarData = (data) => {
  const dataNormalizada = normalize({ id: 'chatHistory', messages: data }, chatSchema);
  return dataNormalizada;
};

const normalizarMensajes = async () => {
  const messages = await dataMsg.getAll();
  const normalizedMessages = normalizarData(messages);
  return normalizedMessages;
};

const httpServer = require('http').createServer(app);
const io = require('socket.io')(httpServer);

httpServer.listen(PORT, () => console.log('SERVER ON http://localhost:' + PORT));

/* Socket */

io.on('connection', async (socket) => {
  socket.emit('products-list', await productosFS);

  socket.emit('productos-test', await FakeP);

  socket.emit('msg-list', await normalizarMensajes());

  socket.on('product', async (data) => {
    console.log('Se recibio un producto nuevo', 'producto:', data);

    await contenedorProductos.save(data);

    io.emit('product-list', await productosFS);
  });

  socket.on('msg', async (data) => {
    await dataMsg.save({ ...data, timestamp: timestamp });

    console.log('Se recibio un msg nuevo', 'msg:', data);

    io.sockets.emit('msg-list', await normalizarMensajes());
  });
});
