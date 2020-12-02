import { ApplicationConfig } from '@nestjs/core';
import { Inject, Injectable, Logger, ForbiddenException, ConflictException } from '@nestjs/common';

import { EmailModuleOptions } from './email-options.interface';
import { EMAIL_MODULE_OPTIONS } from './email.constants';

import {
    generateHmac,
    getControllerMethodRoute,
    signatureHasExpired,
    isSignatureEqual,
    stringifyQueryParams,
    generateUrl,
    isObjectEmpty,
} from './helpers';

import {
    GenerateUrlFromControllerArgs,
    GenerateUrlFromPathArgs,
    IsSignatureValidArgs,
    SignedControllerUrlArgs,
    SignedUrlArgs
} from './interfaces';

@Injectable()
export class EmailService {

    constructor(
        @Inject(EMAIL_MODULE_OPTIONS)
        private readonly urlGeneratorModuleOptions: EmailModuleOptions,
        private readonly applicationConfig: ApplicationConfig,
    ) {
        if (this.urlGeneratorModuleOptions.secret && (this.urlGeneratorModuleOptions.secret.length < 32)) {
            Logger.warn('[urlGeneratorModuleOptions] A min key length of 256-bit or 32-characters is recommended')
        }

        if (!this.urlGeneratorModuleOptions.appUrl) {
            throw new Error('The app url must not be empty');
        }
    }

    public generateUrlFromController({
        controller,
        controllerMethod,
        query,
        params,
    }: GenerateUrlFromControllerArgs): string {
        const controllerMethodFullRoute = getControllerMethodRoute(controller, controllerMethod)

        return this.generateUrlFromPath({
            relativePath: controllerMethodFullRoute,
            query,
            params
        })
    }

    public generateUrlFromPath({ relativePath, query, params }: GenerateUrlFromPathArgs): string {
        return generateUrl(
            this.urlGeneratorModuleOptions.appUrl,
            this.applicationConfig.getGlobalPrefix(),
            relativePath,
            query,
            params
        )
    }

    public signedControllerUrl({
        controller,
        controllerMethod,
        expirationDate,
        query,
        params,
    }: SignedControllerUrlArgs): string {
        const controllerMethodFullRoute = getControllerMethodRoute(controller, controllerMethod)

        return this.signedUrl({
            relativePath: controllerMethodFullRoute,
            expirationDate,
            query,
            params
        })
    }

    public signedUrl({
        relativePath,
        expirationDate,
        query = {},
        params
    }: SignedUrlArgs): string {
        if (expirationDate) {
            query.expirationDate = expirationDate.toISOString()
        }
        const urlWithoutHash = generateUrl(
            this.urlGeneratorModuleOptions.appUrl,
            this.applicationConfig.getGlobalPrefix(),
            relativePath,
            query,
            params,
        )

        query.signed = generateHmac(urlWithoutHash, this.urlGeneratorModuleOptions.secret)
        const urlWithHash = generateUrl(
            this.urlGeneratorModuleOptions.appUrl,
            this.applicationConfig.getGlobalPrefix(),
            relativePath,
            query,
            params,
        )

        return urlWithHash
    }

    public isSignatureValid({ host, routePath, query }: IsSignatureValidArgs): boolean {
        const { signed, ...restQuery } = query
        const fullUrl = isObjectEmpty(restQuery)
            ? `${host}${routePath}`
            : `${host}${routePath}?${stringifyQueryParams(restQuery)}`

        const hmac = generateHmac(fullUrl, this.urlGeneratorModuleOptions.secret)

        if (!signed || !hmac || (signed.length != hmac.length)) {
            throw new ForbiddenException('Invalid Url')
        } else {
            if (restQuery.expirationDate) {
                const expiryDate = new Date(restQuery.expirationDate)
                if (signatureHasExpired(expiryDate)) return false
            }
            return isSignatureEqual(signed, hmac)
        }
    }
}
