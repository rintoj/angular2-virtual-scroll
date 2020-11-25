import { Component } from '@angular/core';

@Component({
  selector: 'app-demo',
  template: `
    <div class="posts" id="demo">
      <h1 class="content-subhead">Demo</h1>
      <section class="post">
        <header class="post-header">
          <a
            class="post-avatar"
            href="https://youtu.be/WKHjvyGF-hM"
            target="_blank"
            ><img width="30" height="30" src="assets/images/youtube-128.png"
          /></a>
          <h2 class="post-title">Demo</h2>
        </header>
        <div class="post-description">
          <div class="post-images pure-g">
            <video src="assets/video/video.mp4" controls loop autoplay></video>
          </div>
        </div>
      </section>
    </div>
  `,
})
export class DemoComponent {}
