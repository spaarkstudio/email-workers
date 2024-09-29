import { EmailMessage } from 'cloudflare:email';
import { createMimeMessage } from 'mimetext/browser';

interface EmailContent {
	name: string;
	email: string;
	subject: string;
	body: string;
}

function responseCorsStatus(status: number, headers: Headers) {
	return new Response(null, { status, headers });
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const { pathname } = new URL(request.url);
		const corsHeaders = new Headers();

		const origin = request.headers.get('Origin');

		if (origin === null) {
			return new Response(null, { status: 403 });
		}

		if (env.ALLOWED_ORIGINS !== '*') {
			const allowedOrigins = env.ALLOWED_ORIGINS.split(',');
			if (allowedOrigins.includes(origin)) {
				corsHeaders.set('Access-Control-Allow-Origin', origin);
			} else {
				return new Response(null, { status: 403 });
			}
		}

		if (pathname === '/send' && request.method === 'POST') {
			const emailContent = (await request.json()) as EmailContent;

			if (typeof emailContent.name !== 'string') {
				return responseCorsStatus(400, corsHeaders);
			}
			if (typeof emailContent.email !== 'string') {
				return responseCorsStatus(400, corsHeaders);
			}
			if (typeof emailContent.subject !== 'string') {
				return responseCorsStatus(400, corsHeaders);
			}
			if (typeof emailContent.body !== 'string') {
				return responseCorsStatus(400, corsHeaders);
			}

			const msg = createMimeMessage();
			msg.setSender({ name: emailContent.name, addr: env.SENDER_ADDRESS });
			msg.setRecipient(env.RECIPIENT_ADDRESS);
			msg.setSubject(emailContent.subject);
			msg.addMessage({
				contentType: 'text/html',
				data: `<b>Sender's email</b>: ${emailContent.email}<br><br><b>Content</b>:<br>${emailContent.body}`,
			});

			var message = new EmailMessage(env.SENDER_ADDRESS, env.RECIPIENT_ADDRESS, msg.asRaw());

			try {
				await env.SEB.send(message);
			} catch (e: any) {
				console.log(e.message);
				return responseCorsStatus(500, corsHeaders);
			}

			return responseCorsStatus(200, corsHeaders);
		}

		return responseCorsStatus(404, corsHeaders);
	},
};
