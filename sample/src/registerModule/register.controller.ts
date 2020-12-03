import { BadRequestException, Controller, Get } from '@nestjs/common';

import { EmailService } from 'nestjs-email-service';

@Controller()
export class RegisterController {
  constructor(private readonly emailService: EmailService) {}

  @Get('sendEmail1')
  async target(): Promise<string> {

    const emailMetaData = {
      to: 'abc@abc.com',
      from: 'abc@abc.com',
      subject: 'hi',
    }

    const templatePath = 'test.mjml'
    
    try {
      await this.emailService.sendMjml(emailMetaData, templatePath, { name: 'Bro' })
    } catch (error) {
      console.log(error)
      throw new BadRequestException(error)
    }
    return 'success';
  }

  @Get('sendEmail2')
  async makeUrl(): Promise<string> {
    return 'success';
  }
}
