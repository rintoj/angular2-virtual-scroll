import { Component } from '@angular/core';
import { ListItem } from '../lists/list-item.component';
import { BaseListComponent } from '../lists/base-list';

@Component({
  selector: 'app-samples',
  templateUrl: 'samples.component.html',
})
export class SamplesComponent {
  public items: ListItem[] = [];

  constructor() {
    this.items = BaseListComponent.generateMultipleRandomItems(10000);
  }
}
