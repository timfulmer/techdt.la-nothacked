/**
 * Created by timfulmer on 3/10/15.
 */
var hapi=require('hapi'),
  validator=require('validator'),
  lodash=require('lodash'),
  server=new hapi.Server(),
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
    return reply();
  };

server.connection({port:3001});

server.register([{register:require('hapi-auth-cookie')},
  {register:require('bell')}], function (err) {
  // setup facebook auth strategy
  server.auth.strategy('facebook','bell',{
    provider: 'facebook',
    password: 'nothacked',
    clientId: '1606637172906569',
    clientSecret: 'ab27f6c02c459b0a60c31a99c6ccdbde',
    isSecure: false
  });
  // hapi-auth-cookie, gives us a place to store the fb session
  server.auth.strategy('session', 'cookie', {
    password: 'nothacked',
    cookie: 'sid-example',
    redirectTo: '/login',
    isSecure: false
  });

  server.route({
    method:'GET',
    path:'/goodnight/{name}',
    config:{
      auth:'session',
      pre:[sanitizeInputs],
      handler:function helloHandler(request,reply){
        return reply(JSON.stringify({goodnight:request.params.name},null,2));
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
        var account = request.auth.credentials;
        request.auth.session.set({account:account});
        return reply(JSON.stringify({msg:'You are logged in.'}));
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
        request.auth.session.clear();
        return reply(JSON.stringify({msg:'You are logged out.'}));
      }
    }
  });

  server.start(function(){
    console.log('Server started:',JSON.stringify(server.info,null,2));
  });
});
