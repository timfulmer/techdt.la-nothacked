/**
 * Created by timfulmer on 3/10/15.
 */
var hapi=require('hapi'),
  validator=require('validator'),
  lodash=require('lodash'),
  server=new hapi.Server(),
  Recaptcha = require('recaptcha').Recaptcha,
  nodemailer = require('nodemailer'),
  transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
      user: 'tim@hopskipdrive.com',
      pass: 'hopSk1p!'
    }
  }),
  uuid = require('node-uuid'),
  sanitizeInputs=function sanitizeInputs(request,reply){
    function sanitize(param){
      var sanitized= validator.toString(param);
      sanitized=validator.trim(sanitized);
      sanitized=validator.escape(sanitized);
      sanitized=validator.stripLow(sanitized);
      return sanitized;
    }
    request.params=lodash.mapValues(request.params,sanitize);
    request.query=lodash.mapValues(request.query,sanitize);
    request.payload=lodash.mapValues(request.payload,sanitize);
    return reply();
  },
  sessions={};

server.connection({port:3000});

server.views({
  engines: {
    html: require('swig')
  },
  path: './views'
});

server.register([{register:require('hapi-auth-cookie')},
  {register:require('bell')}], function (err) {
  // bell, facebook
  server.auth.strategy('facebook','bell',{
    provider: 'facebook',
    password: 'nothacked',
    clientId: '1606637172906569',
    clientSecret: 'ab27f6c02c459b0a60c31a99c6ccdbde',
    isSecure: false
  });
  // hapi-auth-cookie
  server.auth.strategy('session', 'cookie', {
    password: 'nothacked',
    cookie: 'sid-example',
    redirectTo: '/login',
    isSecure: false
  });

  server.route({
    method:'GET',
    path:'/hello/{name}',
    config:{
      auth:'session',
      pre:[sanitizeInputs],
      handler:function helloHandler(request,reply){
        var accountId=request.auth.credentials.account.profile.id,
          session=sessions[accountId];
        if(!session.visits){
          session.visits=0;
        }
        session.visits++;
        if(session.visits>3){
          var recaptcha = new Recaptcha('6LdgqwMTAAAAAOAWzxl80wIKPzevlJIo6eAY14QK',
            '6LdgqwMTAAAAALs541x9LeqkLuYXhZEWjclpRC9c');
          return reply.view('captcha.html',{html:recaptcha.toHTML(),path:request.path})
        }
        return reply(JSON.stringify({hello:request.params.name}));
      }
    }
  });
  server.route({
    method:'POST',
    path:'/hello/{name}',
    config:{
      auth:'session',
      pre:[sanitizeInputs],
      handler:function helloHandler(request,reply){
        var data = {
          remoteip:  '127.0.0.1',
          response:  request.payload['g-recaptcha-response']
        };
        var recaptcha = new Recaptcha('6LdgqwMTAAAAAOAWzxl80wIKPzevlJIo6eAY14QK',
          '6LdgqwMTAAAAALs541x9LeqkLuYXhZEWjclpRC9c',data);
        recaptcha.verify(function(success, error_code) {
          if (success) {
            var accountId=request.auth.credentials.account.profile.id,
              session=sessions[accountId];
            session.visits=0;
          }
          return reply.redirect(request.path);
        });
      }
    }
  });
  server.route({
    method: ['GET','POST'], // Must handle both GET and POST
    path: '/login',          // The callback endpoint registered with the provider
    config: {
      auth:{mode: 'try', strategy: 'facebook'},
      pre:[sanitizeInputs],
      handler: function loginHandler(request,reply) {
        var account = request.auth.credentials,
          accountId=account.profile.id,
          session=sessions[accountId];
        if(!session){
          sessions[accountId]=session={};
        }
        session.key=uuid.v4();
        session.account=account;
        var mailOptions={
          from:'me@timfulmer.com',
          to:account.profile.email,
          subject:'Please Confirm Identity',
          html:'<html><body><a href="http://localhost:3000/mfa?key='+
            session.key+'&id='+accountId+'">Click Here</a></body></head>'
        };
        transporter.sendMail(mailOptions,function(err,results){
          if(err){
            console.log('Could not send authentication email.',err);
            return reply(JSON.stringify({err:err}));
          }
          return reply(JSON.stringify({msg:'Please check your email for a login link.'}));
        });
      }
    }
  });
  server.route({
    method: ['GET','POST'], // Must handle both GET and POST
    path: '/mfa',          // The callback endpoint registered with the provider
    config: {
      pre:[sanitizeInputs],
      handler: function loginHandler(request,reply) {
        var accountId=request.query.id,
          session=sessions[accountId];
        if(!session){
          sessions[accountId]=session={};
        }
        if(request.query.key && request.query.key===session.key){
          delete session.key;
          request.auth.session.set({accountId:accountId});
          return reply(JSON.stringify({msg:'You are logged in.'}));
        }
        return reply.redirect('/login');
      }
    }
  });
  server.route({
    method:'GET',
    path:'/logout',
    config:{
      auth:'session',
      pre:[sanitizeInputs],
      handler:function logoutHandler(request,reply) {
        var accountId=request.auth.credentials.account.profile.id;
        delete sessions[accountId];
        request.auth.session.clear();
        return reply(JSON.stringify({msg:'You are logged out.'}));
      }
    }
  });

  server.start(function(){
    console.log('Server started:',JSON.stringify(server.info,null,2));
  });
});
