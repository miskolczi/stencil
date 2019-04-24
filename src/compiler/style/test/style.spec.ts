import { Compiler, Config } from '@stencil/core/compiler';
import { TestingConfig } from '@stencil/core/testing';
import path from 'path';


describe('component-styles', () => {

  let compiler: Compiler;
  let config: Config;
  const root = path.resolve('/');

  beforeEach(async () => {
    config = new TestingConfig();
    compiler = new Compiler(config);
    await compiler.fs.writeFile(path.join(root, 'src', 'index.html'), `<cmp-a></cmp-a>`);
    await compiler.fs.commit();
  });


  it('should escape unicode characters', async () => {
    await compiler.fs.writeFiles({
      [path.join(root, 'src', 'cmp-a.css')]: `.myclass:before { content: "\\F113"; }`,
      [path.join(root, 'src', 'cmp-a.tsx')]: `@Component({ tag: 'cmp-a', styleUrl: 'cmp-a.css' })export class CmpA {}`,
    });
    await compiler.fs.commit();

    const r = await compiler.build();
    expect(r.diagnostics).toHaveLength(0);

    const content = await compiler.fs.readFile(path.join(root, 'www', 'build', 'cmp-a.entry.js'));
    expect(content).toContain('\\\\F113');
  });

  it('should escape octal literals', async () => {
    await compiler.fs.writeFiles({
      [path.join(root, 'src', 'cmp-a.css')]: `.myclass:before { content: "\\2014 \\00A0"; }`,
      [path.join(root, 'src', 'cmp-a.tsx')]: `@Component({ tag: 'cmp-a', styleUrl: 'cmp-a.css' }) export class CmpA {}`,
    });
    await compiler.fs.commit();

    const r = await compiler.build();
    expect(r.diagnostics).toHaveLength(0);

    const content = await compiler.fs.readFile(path.join(root, 'www', 'build', 'cmp-a.entry.js'));
    expect(content).toContain('\\\\2014 \\\\00A0');
  });

  it('should build one component w/ inline style', async () => {
    compiler.config.watch = true;
    await compiler.fs.writeFiles({
      [path.join(root, 'src', 'cmp-a.tsx')]: `@Component({ tag: 'cmp-a', styles: 'body { color: red; }' }) export class CmpA {}`,
    });
    await compiler.fs.commit();

    let r = await compiler.build();
    expect(r.diagnostics).toHaveLength(0);
    expect(r.styleBuildCount).toBe(1);

    let content = await compiler.fs.readFile(path.join(root, 'www', 'build', 'cmp-a.entry.js'));
    expect(content).toContain('color: red');

    const rebuildListener = compiler.once('buildFinish');

    await compiler.fs.writeFiles({
      [path.join(root, 'src', 'cmp-a.tsx')]: `@Component({ tag: 'cmp-a', styles: 'body { color: green; }' }) export class CmpA {}`,
    }, { clearFileCache: true });
    await compiler.fs.commit();

    compiler.trigger('fileUpdate', path.join(root, 'src', 'cmp-a.tsx'));

    r = await rebuildListener;
    expect(r.diagnostics).toHaveLength(0);

    content = await compiler.fs.readFile(path.join(root, 'www', 'build', 'cmp-a.entry.js'));
    expect(content).toContain(`color: green`);
    expect(r.styleBuildCount).toBe(1);
  });

  it('should add mode styles to hashed filename/minified builds', async () => {
    compiler.config.minifyJs = true;
    compiler.config.minifyCss = true;
    compiler.config.hashFileNames = true;
    compiler.config.hashedFileNameLength = 1;
    await compiler.fs.writeFiles({
      [path.join(root, 'src', 'cmp-a.tsx')]: `@Component({
        tag: 'cmp-a',
        styleUrls: {
          ios: 'cmp-a.ios.css',
          md: 'cmp-a.md.css'
        }
      })
      export class CmpA {}`,

      [path.join(root, 'src', 'cmp-a.ios.css')]: `body{font-family:Helvetica}`,
      [path.join(root, 'src', 'cmp-a.md.css')]: `body{font-family:Roboto}`
    });
    await compiler.fs.commit();

    const r = await compiler.build();
    expect(r.diagnostics).toHaveLength(0);

    const iosContent = await compiler.fs.readFile(path.join(root, 'www', 'build', 'u.entry.js'));
    expect(iosContent).toContain(`body{font-family:Helvetica}`);
    expect(iosContent).toContain(`static get styleMode(){return"ios"}`);

    const mdContent = await compiler.fs.readFile(path.join(root, 'www', 'build', 'h.entry.js'));
    expect(mdContent).toContain(`body{font-family:Roboto}`);
    expect(mdContent).toContain(`static get styleMode(){return"md"}`);
  });

  it('should add default styles to hashed filename/minified builds', async () => {
    compiler.config.minifyJs = true;
    compiler.config.minifyCss = true;
    compiler.config.hashFileNames = true;
    compiler.config.sys.generateContentHash = function() {
      return 'hashed';
    };

    await compiler.fs.writeFiles({
      [path.join(root, 'src', 'cmp-a.tsx')]: `@Component({ tag: 'cmp-a', styleUrl: 'cmp-a.css' }) export class CmpA {}`,
      [path.join(root, 'src', 'cmp-a.css')]: `body{color:red}`
    });
    await compiler.fs.commit();

    const r = await compiler.build();
    expect(r.diagnostics).toHaveLength(0);

    const content = await compiler.fs.readFile(path.join(root, 'www', 'build', 'hashed.entry.js'));
    expect(content).toContain(`body{color:red}`);
  });

  it('should minify styleUrl', async () => {
    compiler.config.watch = true;
    compiler.config.minifyCss = true;
    await compiler.fs.writeFiles({
      [path.join(root, 'src', 'cmp-a.tsx')]: `@Component({ tag: 'cmp-a', styleUrl: 'cmp-a.css' }) export class CmpA {}`,
      [path.join(root, 'src', 'cmp-a.css')]: `body {    color:        red;    /** plz  minify me **/ }`
    });
    await compiler.fs.commit();

    let r = await compiler.build();
    expect(r.diagnostics).toHaveLength(0);
    expect(r.styleBuildCount).toBe(1);

    let content = await compiler.fs.readFile(path.join(root, 'www', 'build', 'cmp-a.entry.js'));
    expect(content).toContain(`body{color:red}`);

    const rebuildListener = compiler.once('buildFinish');

    await compiler.fs.writeFiles({
      [path.join(root, 'src', 'cmp-a.css')]: `body {    color:        green;    /** plz  minify me **/ }`
    }, { clearFileCache: true });
    await compiler.fs.commit();

    compiler.trigger('fileUpdate', path.join(root, 'src', 'cmp-a.css'));

    r = await rebuildListener;
    expect(r.diagnostics).toHaveLength(0);
    expect(r.styleBuildCount).toBe(1);

    content = await compiler.fs.readFile(path.join(root, 'www', 'build', 'cmp-a.entry.js'));
    expect(content).toContain(`color:green`);
  });

  it('should build one component w/ styleUrl, and re-compile css import of css import changes', async () => {
    compiler.config.watch = true;
    await compiler.fs.writeFiles({
      [path.join(root, 'src', 'cmp-a.tsx')]: `@Component({ tag: 'cmp-a', styleUrl: 'file-a.css', shadow: true }) export class CmpA {}`,
      [path.join(root, 'src', 'file-a.css')]: `@import "file-b.css"; div { color: red; }`,
      [path.join(root, 'src', 'file-b.css')]: `@import "file-c.css"; span { color: green; }`,
      [path.join(root, 'src', 'file-c.css')]: `p { color: blue; }`
    });
    await compiler.fs.commit();

    let r = await compiler.build();
    expect(r.diagnostics).toHaveLength(0);
    expect(r.components).toHaveLength(1);
    expect(r.transpileBuildCount).toBe(1);
    // expect(r.bundleBuildCount).toBe(1);
    expect(r.styleBuildCount).toBe(1);

    let content = await compiler.fs.readFile(path.join(root, 'www', 'build', 'cmp-a.entry.js'));
    expect(content).toContain(`color: red`);
    expect(content).toContain(`color: green`);
    expect(content).toContain(`color: blue`);

    const rebuildListener = compiler.once('buildFinish');

    await compiler.fs.writeFiles({
      [path.join(root, 'src', 'file-c.css')]: `p { color: yellow; }`,
    }, { clearFileCache: true });
    await compiler.fs.commit();

    compiler.trigger('fileUpdate', path.join(root, 'src', 'file-c.css'));

    r = await rebuildListener;
    expect(r.diagnostics).toHaveLength(0);
    expect(r.styleBuildCount).toBe(1);

    content = await compiler.fs.readFile(path.join(root, 'www', 'build', 'cmp-a.entry.js'));
    expect(content).toContain(`color: red`);
    expect(content).toContain(`color: green`);
    expect(content).not.toContain(`color: blue`);
    expect(content).toContain(`color: yellow`);
  });

  it('should build one component w/ styleUrl, and not re-compile styles w/ no style changes', async () => {
    compiler.config.watch = true;
    await compiler.fs.writeFiles({
      [path.join(root, 'src', 'cmp-a.tsx')]: `@Component({ tag: 'cmp-a', styleUrl: 'cmp-a.css', shadow: true }) export class CmpA {}`,
      [path.join(root, 'src', 'cmp-a.css')]: `body { color: red; }`
    });
    await compiler.fs.commit();

    let r = await compiler.build();
    expect(r.diagnostics).toHaveLength(0);
    expect(r.components).toHaveLength(1);
    expect(r.transpileBuildCount).toBe(1);
    // expect(r.bundleBuildCount).toBe(1);
    expect(r.styleBuildCount).toBe(1);

    let content = await compiler.fs.readFile(path.join(root, 'www', 'build', 'cmp-a.entry.js'));
    expect(content).toContain(`color: red`);

    const rebuildListener = compiler.once('buildFinish');

    await compiler.fs.writeFiles({
      [path.join(root, 'src', 'cmp-a.tsx')]: `@Component({ tag: 'cmp-a', styleUrl: 'cmp-a.css' }) export class CmpA { constructor() { console.log('88'); } }`,
    }, { clearFileCache: true });
    await compiler.fs.commit();

    compiler.trigger('fileUpdate', path.join(root, 'src', 'cmp-a.tsx'));

    r = await rebuildListener;
    expect(r.diagnostics).toHaveLength(0);
    expect(r.styleBuildCount).toBe(0);

    content = await compiler.fs.readFile(path.join(root, 'www', 'build', 'cmp-a.entry.js'));
    expect(content).toContain(`color: red`);
    expect(content).toContain(`console.log('88')`);
  });

  it('should build one component w/ styleUrl, and re-compile component decorator styles url changes', async () => {
    compiler.config.watch = true;
    await compiler.fs.writeFiles({
      [path.join(root, 'src', 'cmp-a.tsx')]: `@Component({ tag: 'cmp-a', styleUrl: 'cmp-a-red.css', shadow: true }) export class CmpA {}`,
      [path.join(root, 'src', 'cmp-a-red.css')]: `body { color: red; }`,
      [path.join(root, 'src', 'cmp-a-blue.css')]: `body { color: blue; }`
    });
    await compiler.fs.commit();

    let r = await compiler.build();
    expect(r.diagnostics).toHaveLength(0);
    expect(r.components).toHaveLength(1);
    expect(r.transpileBuildCount).toBe(1);
    // expect(r.bundleBuildCount).toBe(1);
    expect(r.styleBuildCount).toBe(1);

    let content = await compiler.fs.readFile(path.join(root, 'www', 'build', 'cmp-a.entry.js'));
    expect(content).toContain(`color: red`);

    const rebuildListener = compiler.once('buildFinish');

    await compiler.fs.writeFiles({
      [path.join(root, 'src', 'cmp-a.tsx')]: `@Component({ tag: 'cmp-a', styleUrl: 'cmp-a-blue.css' }) export class CmpA { constructor() { console.log('88'); } }`,
    }, { clearFileCache: true });
    await compiler.fs.commit();

    compiler.trigger('fileUpdate', path.join(root, 'src', 'cmp-a.tsx'));

    r = await rebuildListener;
    expect(r.diagnostics).toHaveLength(0);
    expect(r.styleBuildCount).toBe(1);

    content = await compiler.fs.readFile(path.join(root, 'www', 'build', 'cmp-a.entry.js'));
    expect(content).toContain(`color: blue`);
    expect(content).toContain(`console.log('88')`);
  });

});
