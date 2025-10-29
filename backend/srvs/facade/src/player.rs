use actix::*;
use actix_web_actors::ws;

// Messages used by Room ↔ Player
#[derive(Message)]
#[rtype(result = "()")]
pub struct PlayerText(pub String);

#[derive(Message)]
#[rtype(result = "()")]
pub struct RegisterPlayer(pub Addr<PlayerSession>);

#[derive(Message)]
#[rtype(result = "()")]
pub struct UnregisterPlayer(pub Addr<PlayerSession>);

#[derive(Message)]
#[rtype(result = "()")]
pub struct PlayerOk(pub Addr<PlayerSession>);

/// Player WebSocket actor
pub struct PlayerSession {
    pub room: Addr<crate::Room>,
}

impl Actor for PlayerSession {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        self.room.do_send(RegisterPlayer(ctx.address()));
    }

    fn stopped(&mut self, ctx: &mut Self::Context) {
        self.room.do_send(UnregisterPlayer(ctx.address()));
    }
}

impl Handler<PlayerText> for PlayerSession {
    type Result = ();

    fn handle(&mut self, msg: PlayerText, ctx: &mut Self::Context) {
        // Broadcasted question JSON received
        ctx.text(msg.0.clone());

        // Automatically send "ok" back to manager
        self.room.do_send(PlayerOk(ctx.address()));
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for PlayerSession {
    fn handle(&mut self, _: Result<ws::Message, ws::ProtocolError>, _: &mut Self::Context) {
        // Players don’t send messages manually
    }
}
