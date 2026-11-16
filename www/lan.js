/* Modo Wi-Fi local: si la página la sirve el servidor LAN de Dibuja y adivina, Peer pasa a hablar por WebSocket
   con ese servidor (sin internet). Si no, no hace nada y el juego usa PeerJS como siempre. */
(function(){var info=null;try{var x=new XMLHttpRequest();x.open("GET","lan.json?"+Date.now(),false);x.send();if(x.status==200){var j=JSON.parse(x.responseText);if(j&&j.app=="dibuja-lan")info=j}}catch(e){}
if(!info)return;window.LANX=info;try{if(localStorage.getItem("dibuja_net")=="internet")return}catch(e){}window.LAN=info;
var URL_=(location.protocol=="https:"?"wss://":"ws://")+location.host+"/ws";
function Conn(p,peer,open){this.p=p;this.peer=peer;this.h={};this.open=!!open}
Conn.prototype.on=function(e,f){this.h[e]=f;return this};
Conn.prototype.send=function(d){if(this.open)this.p._tx({k:"d",to:this.peer,d:d})};
Conn.prototype.close=function(){if(this.open){this.open=false;this.p._tx({k:"cl",to:this.peer})}};
Conn.prototype._e=function(e,a){if(this.h[e])try{this.h[e](a)}catch(x){console.error(x)}};
function LPeer(id,o){if(id&&typeof id=="object")id=null;this.id=null;this._want=id||null;this.h={};this.c={};this.dead=false;this._q=[];var me=this,ws=this.ws=new WebSocket(URL_);
ws.onopen=function(){me._tx({k:"reg",id:me._want})};
ws.onmessage=function(e){var m;try{m=JSON.parse(e.data)}catch(x){return}me._rx(m)};
ws.onerror=function(){if(!me.id)me._e("error",{type:"network"})};
ws.onclose=function(){if(me.dead)return;me.dead=true;for(var k in me.c){var c=me.c[k];if(c.open){c.open=false;c._e("close")}}if(me.id)me._e("disconnected");else me._e("error",{type:"network"})}}
LPeer.prototype.on=function(e,f){this.h[e]=f;return this};
LPeer.prototype._e=function(e,a){if(this.h[e])try{this.h[e](a)}catch(x){console.error(x)}};
LPeer.prototype._tx=function(o){if(this.ws.readyState==1)this.ws.send(JSON.stringify(o));else if(this.ws.readyState==0)this._q.push(o)};
LPeer.prototype._rx=function(m){var c;
if(m.k=="open"){this.id=m.id;this._e("open",m.id);var q=this._q;this._q=[];for(var i=0;i<q.length;i++)this._tx(q[i])}
else if(m.k=="err"){this._e("error",{type:m.type})}
else if(m.k=="conn"){c=new Conn(this,m.from,true);this.c[m.from]=c;this._e("connection",c);this._tx({k:"ack",to:m.from})}
else if(m.k=="ack"){c=this.c[m.from];if(c&&!c.open){c.open=true;c._e("open")}}
else if(m.k=="d"){c=this.c[m.from];if(c)c._e("data",m.d)}
else if(m.k=="cl"){c=this.c[m.from];if(c&&c.open){c.open=false;c._e("close")}delete this.c[m.from]}};
LPeer.prototype.connect=function(id){var c=new Conn(this,id,false);this.c[id]=c;this._tx({k:"conn",to:id});return c};
LPeer.prototype.destroy=function(){this.dead=true;try{this.ws.close()}catch(e){}};
window.Peer=LPeer})();
