import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { importProvidersFrom } from '@angular/core';
import { LayoutDashboard, LucideAngularModule, MessageSquare, PanelLeftClose, PanelLeftOpen, PanelRightOpen, LogOut, ChevronLeft, ChevronRight, Settings } from 'lucide-angular';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app';

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),

    // ✅ Wrap the module in importProvidersFrom
    importProvidersFrom(
      LucideAngularModule.pick({
        PanelRightOpen,
        LayoutDashboard,
        MessageSquare,
        PanelLeftClose,
        PanelLeftOpen, LogOut,
        ChevronLeft,
        ChevronRight,
        Settings,
      
      })
    )
  ]
}).catch(err => console.error(err));