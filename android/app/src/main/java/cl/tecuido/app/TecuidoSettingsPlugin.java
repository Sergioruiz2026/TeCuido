package cl.tecuido.app;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "TecuidoSettings")
public class TecuidoSettingsPlugin extends Plugin {
    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
        } else {
            intent.putExtra("app_package", getContext().getPackageName());
            intent.putExtra("app_uid", getContext().getApplicationInfo().uid);
        }

        try {
            getActivity().startActivity(intent);
            call.resolve();
        } catch (ActivityNotFoundException error) {
            Intent appSettings = new Intent(
                Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.fromParts("package", getContext().getPackageName(), null)
            );
            try {
                getActivity().startActivity(appSettings);
                call.resolve();
            } catch (ActivityNotFoundException fallbackError) {
                call.reject("No se pudieron abrir los ajustes de la aplicación.", fallbackError);
            }
        }
    }
}
