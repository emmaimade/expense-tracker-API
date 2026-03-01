import { Resend } from 'resend';

let resend;

const getResend = () => {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
};

const sendEmail = async ({ to, subject, html }) => {
  await getResend().emails.send({
    from: 'SpendWise <onboarding@resend.dev>',
    to,
    subject,
    html,
  });
};

export default sendEmail;