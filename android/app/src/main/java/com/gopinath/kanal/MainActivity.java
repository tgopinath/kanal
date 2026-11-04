package com.gopinath.kanal;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TableARPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
