use actix::*;
use actix_web_actors::ws;
use serde_json::to_string;

use crate::{player::PlayerSession, Question, OptionItem};

#[derive(Message)]
#[rtype(result = "()")]
pub struct ManagerText(pub String);

#[derive(Message)]
#[rtype(result = "()")]
pub struct RegisterManager(pub Addr<ManagerSession>);

#[derive(Message)]
#[rtype(result = "()")]
pub struct UnregisterManager;

#[derive(Message)]
#[rtype(result = "()")]
pub struct BroadcastToPlayers(pub String);

pub struct ManagerSession {
    pub room: Addr<crate::Room>,
}

impl Actor for ManagerSession {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        self.room.do_send(RegisterManager(ctx.address()));
    }

    fn stopped(&mut self, _: &mut Self::Context) {
        self.room.do_send(UnregisterManager);
    }
}

impl Handler<ManagerText> for ManagerSession {
    type Result = ();

    fn handle(&mut self, msg: ManagerText, ctx: &mut Self::Context) {
        ctx.text(msg.0);
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for ManagerSession {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, _: &mut Self::Context) {
        if let Ok(ws::Message::Text(text)) = msg {
            match text.to_string().as_ref() {
                "next" => {
                    // Example question; you can later replace this with DB or dynamic logic
                    let question = Question {
                        r#type: 2,
                        question_id: 24,
                        question_text: "How are you?".to_string(),
                        question_time: 40,
                        max_point: 100,
                        min_point: 0,
                        options: vec![
                            OptionItem { option_id: 58, option_text: "Not bad".to_string() },
                            OptionItem { option_id: 59, option_text: "Very good!".to_string() },
                        ],
                    };

                    let json = to_string(&question).unwrap();
                    self.room.do_send(BroadcastToPlayers(json));
                }

                "previous" => {
                    // You could implement "previous" logic here (e.g. load previous question)
                    eprintln!("Manager sent 'previous'");
                }

                _ => {
                    eprintln!("⚠️ Unknown command from manager: {}", text);
                }
            }
        }
    }
}
