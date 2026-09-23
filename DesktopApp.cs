using System;
using System.Drawing;
using System.IO;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

[assembly: System.Reflection.AssemblyTitle("Radiology Report Copilot")]
[assembly: System.Reflection.AssemblyProduct("Radiology Report Copilot")]
[assembly: System.Reflection.AssemblyCopyright("Copyright \u00a9 2026 Jinhyong Goh. All rights reserved.")]

namespace RadiologyReportCopilot
{
    internal static class Program
    {
        [STAThread]
        private static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new ReportWindow());
        }
    }

    internal sealed class ReportWindow : Form
    {
        private const string AppUrl = "https://radiology-report-copilot.example/index.html";
        private readonly WebView2 browser = new WebView2();

        public ReportWindow()
        {
            Text = "Radiology Report Copilot";
            Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            AutoScaleMode = AutoScaleMode.Dpi;
            ClientSize = new Size(1400, 900);
            MinimumSize = new Size(720, 600);
            StartPosition = FormStartPosition.CenterScreen;
            WindowState = FormWindowState.Normal;
            browser.Dock = DockStyle.Fill;
            Controls.Add(browser);
            Shown += InitializeBrowser;
        }

        private async void InitializeBrowser(object sender, EventArgs args)
        {
            try
            {
                string root = AppDomain.CurrentDomain.BaseDirectory;
                if (!File.Exists(Path.Combine(root, "index.html")))
                    throw new FileNotFoundException("Keep index.html and the app files beside RadiologyReportCopilot.exe.");

                // This portable app has a separate browser profile; report drafts stay in memory.
                var environment = await CoreWebView2Environment.CreateAsync(null, Path.Combine(root, ".webview2"));
                if (IsDisposed) return;
                await browser.EnsureCoreWebView2Async(environment);
                if (IsDisposed) return;
                browser.CoreWebView2.Settings.IsGeneralAutofillEnabled = false;
                browser.CoreWebView2.Settings.IsPasswordAutosaveEnabled = false;
                browser.CoreWebView2.SetVirtualHostNameToFolderMapping(
                    "radiology-report-copilot.example", root, CoreWebView2HostResourceAccessKind.Deny);
                browser.CoreWebView2.DownloadStarting += SaveReport;
                browser.CoreWebView2.WebMessageReceived += ReceiveDesktopCommand;
                browser.CoreWebView2.NavigationCompleted += FitWindowToContent;
                browser.CoreWebView2.Navigate(AppUrl);
            }
            catch (Exception error)
            {
                if (IsDisposed) return;
                MessageBox.Show(this,
                    "Could not open the app. Check that Microsoft Edge WebView2 Runtime is installed and that the app folder is writable.\n\n" + error.Message,
                    Text, MessageBoxButtons.OK, MessageBoxIcon.Error);
                Close();
            }
        }

        private async void FitWindowToContent(object sender, CoreWebView2NavigationCompletedEventArgs args)
        {
            if (!args.IsSuccess || browser.Source.AbsoluteUri != AppUrl) return;
            browser.CoreWebView2.NavigationCompleted -= FitWindowToContent;
            try
            {
                // Measure natural panel height instead of letting the viewport size the report.
                string result = await browser.CoreWebView2.ExecuteScriptAsync(@"(() => {
                    document.documentElement.classList.add('desktop-window');
                    return Math.ceil(document.body.getBoundingClientRect().height *
                        window.devicePixelRatio);
                })()");
                int contentHeight;
                if (IsDisposed || !int.TryParse(result, out contentHeight)) return;
                Rectangle available = Screen.FromControl(this).WorkingArea;
                int frameHeight = Height - ClientSize.Height;
                MinimumSize = new Size(Math.Min(720, available.Width), Math.Min(600, available.Height));
                Size = new Size(Math.Min(Width, available.Width),
                    Math.Min(Math.Max(MinimumSize.Height, contentHeight + frameHeight), available.Height));
                Location = new Point(available.Left + (available.Width - Width) / 2,
                    available.Top + (available.Height - Height) / 2);
            }
            catch (Exception)
            {
                // Keep the initial usable window size if navigation closes during measurement.
            }
        }

        internal string HandleDesktopCommand(string source, string command)
        {
            if (source != AppUrl) return null;
            switch (command)
            {
                case "always-on-top:on": TopMost = true; break;
                case "always-on-top:off": TopMost = false; break;
                case "desktop-ready": break;
                default: return null;
            }
            return TopMost ? "always-on-top:on" : "always-on-top:off";
        }

        private void ReceiveDesktopCommand(object sender, CoreWebView2WebMessageReceivedEventArgs args)
        {
            string command;
            try { command = args.TryGetWebMessageAsString(); }
            catch (ArgumentException) { return; }
            string response = HandleDesktopCommand(args.Source, command);
            if (response != null) browser.CoreWebView2.PostWebMessageAsString(response);
        }

        private void SaveReport(object sender, CoreWebView2DownloadStartingEventArgs args)
        {
            // Defer the native dialog until the WebView2 callback has returned.
            var deferral = args.GetDeferral();
            args.Handled = true;
            BeginInvoke(new Action(delegate
            {
                try
                {
                    using (var dialog = new SaveFileDialog())
                    {
                        dialog.Title = "Save report";
                        dialog.Filter = "Text report (*.txt)|*.txt";
                        dialog.DefaultExt = "txt";
                        dialog.FileName = Path.GetFileName(args.ResultFilePath);
                        if (dialog.ShowDialog(this) == DialogResult.OK)
                            args.ResultFilePath = dialog.FileName;
                        else
                            args.Cancel = true;
                    }
                }
                finally { deferral.Complete(); }
            }));
        }
    }
}
