import { EmailMessage } from 'cloudflare:email';
import { createMimeMessage } from 'mimetext/browser';
import { nanoid } from 'nanoid';

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

			if (typeof emailContent.name !== 'string' || emailContent.name.length === 0) {
				return Response.json(
					{
						success: false,
						reason: 'Name was left empty.',
					},
					{
						status: 400,
						headers: corsHeaders,
					}
				);
			}
			if (typeof emailContent.email !== 'string' || emailContent.email.length === 0) {
				return Response.json(
					{
						success: false,
						reason: 'Email was left empty.',
					},
					{
						status: 400,
						headers: corsHeaders,
					}
				);
			}
			if (typeof emailContent.subject !== 'string' || emailContent.subject.length === 0) {
				return Response.json(
					{
						success: false,
						reason: 'Email subject was left empty.',
					},
					{
						status: 400,
						headers: corsHeaders,
					}
				);
			}
			if (typeof emailContent.body !== 'string' || emailContent.body.length === 0) {
				return Response.json(
					{
						success: false,
						reason: 'Email body was left empty.',
					},
					{
						status: 400,
						headers: corsHeaders,
					}
				);
			}

			const emailRegex =
				/[-A-Za-z0-9!#$%&'*+/=?^_`{|}~]+(?:\.[-A-Za-z0-9!#$%&'*+/=?^_`{|}~]+)*@(?:[A-Za-z0-9](?:[-A-Za-z0-9]*[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[-A-Za-z0-9]*[A-Za-z0-9])?/g;
			if (emailContent.email.length > 320 || !emailRegex.test(emailContent.email)) {
				return Response.json(
					{
						success: false,
						reason: 'Invalid email format.',
					},
					{
						status: 400,
						headers: corsHeaders,
					}
				);
			}

			emailContent.body = emailContent.body.replace(/</g, '&lt;').replace(/>/g, '&#62;');

			const msg = createMimeMessage();
			msg.setSender({ name: emailContent.name, addr: env.SENDER_ADDRESS });
			msg.setRecipient(env.RECIPIENT_ADDRESS);
			msg.setSubject(`${emailContent.subject} - #${nanoid()}`);
			msg.addMessage({
				contentType: 'text/html',
				data: `<b>Sender's email</b>: ${emailContent.email}<br><br><b>Content</b>:<br>${emailContent.body}<br><br><b>This email was sent by a service, do not reply.</b>`,
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
