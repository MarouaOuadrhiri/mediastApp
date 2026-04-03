import { inject, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';

export const authGuard = () => {
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);
  
  if (isPlatformBrowser(platformId)) {
    if (localStorage.getItem('token')) {
      return true;
    }
    router.navigate(['/login']);
    return false;
  }
  return true; // Allow server render
};

export const adminGuard = () => {
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  if (isPlatformBrowser(platformId)) {
    if (localStorage.getItem('role') === 'ADMIN') {
      return true;
    }
    router.navigate(['/login']);
    return false;
  }
  return true;
};

export const employeeGuard = () => {
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  if (isPlatformBrowser(platformId)) {
    if (localStorage.getItem('role') === 'EMPLOYEE') {
      return true;
    }
    router.navigate(['/login']);
    return false;
  }
  return true;
};
