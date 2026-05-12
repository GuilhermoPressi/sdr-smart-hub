import { UnauthorizedException } from '@nestjs/common';

export class TenantHelper {
  /**
   * Recupera o companyId do usuário logado ou lança erro de não autorizado.
   * Usado para garantir isolamento em todas as queries.
   */
  static getCompanyIdOrThrow(user: any): string {
    const companyId = user?.companyId;
    
    if (!companyId) {
      throw new UnauthorizedException('Tenant context not found. Please login again.');
    }
    
    return companyId;
  }
}
